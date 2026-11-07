// One codebase, two apps.
//
//   unset / passenger → "ToGo"        (app.togo.mobile)  passengers only
//   staff             → "ToGo Staff"  (app.togo.staff)   crew + operations only
//   combined          → demo-only build with every space, so a single phone can
//                       show the whole loop. Opt-in (npm run preview:combined);
//                       never a store build.
//
// The variant is also read at runtime (src/env.ts) to decide which spaces exist.
//
// GOOGLE_MAPS_ANDROID_API_KEY (build-time secret, not EXPO_PUBLIC_) is required for
// maps in Android release builds; Expo Go uses its own key. Set it as an EAS secret.

// EAS projects, one per app: @elly1/togo-mobile and @elly1/togo-staff on expo.dev.
// Project ids are not secrets. Builds, EAS build workers and the release workflow all
// read them from here; the env vars only override them for a one-off build.
const EAS = {
  owner: process.env.EAS_OWNER || 'elly1',
  passenger: process.env.EAS_PROJECT_ID_TOGO || '6a252db7-a44b-4799-a6c2-292f50f968a9',
  staff: process.env.EAS_PROJECT_ID_TOGO_STAFF || 'e220d911-6a53-4bb0-a67c-a4ea93d35036',
};

// Permission prompts must describe what THIS app does with the permission
// (App Store 5.1.1, Play permissions policy), so each app gets its own wording.
const PERMISSION_TEXT = {
  passenger: {
    location: 'ToGo uses your location to show where you are on the map and which pickup hub is nearest. It stays on your phone.',
    camera: 'ToGo does not use the camera.',
  },
  staff: {
    location: 'ToGo Staff shares the bus’s position with passengers while you run a trip, and shows where you are on the map. Sharing stops when the trip ends.',
    camera: 'ToGo Staff uses the camera to scan passengers’ boarding codes. Images are not saved.',
  },
  combined: {
    location: 'ToGo shows where you are on the map. Drivers share the bus’s position while a trip is running.',
    camera: 'ToGo uses the camera to scan passengers’ boarding codes. Images are not saved.',
  },
};

/**
 * Store builds must be connected, single-variant builds. Fail the EAS build early
 * instead of shipping a binary that opens on a setup screen or on fictional data
 * (App Store 2.1 / 2.3, Play "minimum functionality"). Runs on EAS build workers
 * only (EAS_BUILD=true), so local `expo start` and CI exports are unaffected.
 */
function assertStoreReady(variant) {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  if (process.env.EAS_BUILD !== 'true' || !profile.startsWith('production')) return;
  const problems = [];
  const demo = (process.env.EXPO_PUBLIC_TOGO_DEMO || '').trim().toLowerCase();
  if (demo === '1' || demo === 'true') problems.push('EXPO_PUBLIC_TOGO_DEMO must not be set for a store build');
  if (variant !== 'passenger' && variant !== 'staff') problems.push('EXPO_PUBLIC_APP_VARIANT must be "passenger" or "staff"');
  if (!(process.env.EXPO_PUBLIC_SUPABASE_URL || '').startsWith('https://')) problems.push('EXPO_PUBLIC_SUPABASE_URL (https) is missing');
  const key = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (key.length < 20) problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing');
  if (/service_role/i.test(key)) problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY looks like a service_role key');
  const required = {
    EXPO_PUBLIC_PRIVACY_URL: 'stores require a privacy policy URL',
    EXPO_PUBLIC_SUPPORT_EMAIL: 'stores require a support contact',
    EXPO_PUBLIC_LEGAL_NAME: 'the privacy policy must name who runs ToGo',
    EXPO_PUBLIC_LEGAL_ADDRESS: 'the privacy policy must give a postal address',
  };
  for (const [k, why] of Object.entries(required)) {
    if (!(process.env[k] || '').trim()) problems.push(`${k} is missing (${why})`);
  }
  if (!(process.env.GOOGLE_MAPS_ANDROID_API_KEY || '').trim() && process.env.EAS_BUILD_PLATFORM === 'android') {
    problems.push('GOOGLE_MAPS_ANDROID_API_KEY is missing (maps would be blank on Android)');
  }
  if (problems.length) {
    throw new Error(`[ToGo] Not a store-ready build (${profile}):\n  - ${problems.join('\n  - ')}\nSee docs/STORE_LAUNCH.md.`);
  }
}

module.exports = ({ config }) => {
  const raw = (process.env.EXPO_PUBLIC_APP_VARIANT || 'passenger').trim().toLowerCase();
  const variant = raw === 'staff' || raw === 'combined' ? raw : 'passenger';
  assertStoreReady(raw);

  const text = PERMISSION_TEXT[variant];
  const staff = variant === 'staff';
  const plugins = (config.plugins ?? []).map((p) => {
    if (!Array.isArray(p)) return p;
    const [name, opts] = p;
    if (name === 'expo-location') return [name, { ...opts, locationWhenInUsePermission: text.location }];
    if (name === 'expo-camera') return [name, { ...opts, cameraPermission: text.camera }];
    if (name === 'expo-splash-screen' && staff) {
      return [name, { ...opts, image: './assets/splash-icon-staff.png' }];
    }
    return p;
  });

  const mapsKey = (process.env.GOOGLE_MAPS_ANDROID_API_KEY || '').trim();
  const androidBase = {
    ...config.android,
    ...(mapsKey ? { config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: mapsKey } } } : {}),
  };
  // The passenger app never opens the camera, so it must not request it on Android.
  const android = variant === 'passenger'
    ? {
        ...androidBase,
        permissions: (androidBase.permissions ?? []).filter((x) => x !== 'android.permission.CAMERA'),
        blockedPermissions: [...(androidBase.blockedPermissions ?? []), 'android.permission.CAMERA'],
      }
    : androidBase;

  const projectId = EAS[variant === 'staff' ? 'staff' : 'passenger'];
  const extra = { ...config.extra, appVariant: variant, ...(projectId ? { eas: { projectId } } : {}) };
  const base = { ...config, ...(EAS.owner ? { owner: EAS.owner } : {}), plugins, android, extra };
  if (!staff) return base;

  // ToGo Staff: own name, bundle id, scheme and icon so both apps can sit side by side.
  return {
    ...base,
    name: 'ToGo Staff',
    slug: 'togo-staff',
    scheme: 'togostaff',
    icon: './assets/icon-staff.png',
    ios: {
      ...config.ios,
      bundleIdentifier: 'app.togo.staff',
      // Drivers share the bus position while a trip runs (foreground only).
      privacyManifests: {
        ...config.ios.privacyManifests,
        NSPrivacyCollectedDataTypes: [
          ...config.ios.privacyManifests.NSPrivacyCollectedDataTypes,
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
        ],
      },
    },
    android: {
      ...android,
      package: 'app.togo.staff',
      // Same bus artwork on a dark tile with a STAFF badge.
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon-staff.png',
        backgroundImage: './assets/adaptive-icon-staff-background.png',
        monochromeImage: './assets/adaptive-icon-mono.png',
        backgroundColor: '#0b2e1c',
      },
    },
  };
};
