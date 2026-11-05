// One codebase, two apps.
//
//   EXPO_PUBLIC_APP_VARIANT=passenger → "ToGo"        (app.togo.mobile)  passengers only
//   EXPO_PUBLIC_APP_VARIANT=staff     → "ToGo Staff"  (app.togo.staff)   crew + operations only
//   unset / "combined"                → development build with every space, so a
//                                       single phone can demo the whole loop.
//
// The variant is also read at runtime (src/env.ts) to decide which spaces exist.
//
// GOOGLE_MAPS_ANDROID_API_KEY (build-time secret, not EXPO_PUBLIC_) is required for
// maps in Android release builds; Expo Go uses its own key. Set it as an EAS secret.
module.exports = ({ config }) => {
  const variant = (process.env.EXPO_PUBLIC_APP_VARIANT || 'combined').trim();
  const mapsKey = (process.env.GOOGLE_MAPS_ANDROID_API_KEY || '').trim();
  const android = {
    ...config.android,
    ...(mapsKey ? { config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: mapsKey } } } : {}),
  };
  const base = { ...config, android, extra: { ...config.extra, appVariant: variant } };
  if (variant !== 'staff') return base;

  // ToGo Staff: own name, bundle id, scheme and icon so both apps can sit side by side.
  const plugins = (config.plugins ?? []).map((p) =>
    Array.isArray(p) && p[0] === 'expo-splash-screen'
      ? [p[0], { ...p[1], image: './assets/splash-icon-staff.png', backgroundColor: '#13a85c' }]
      : p,
  );
  return {
    ...base,
    name: 'ToGo Staff',
    slug: 'togo-staff',
    scheme: 'togostaff',
    icon: './assets/icon-staff.png',
    plugins,
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
      adaptiveIcon: { ...android.adaptiveIcon, foregroundImage: './assets/adaptive-icon-staff.png', backgroundColor: '#13a85c' },
    },
  };
};
