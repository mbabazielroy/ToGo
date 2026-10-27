// One codebase, two apps.
//
//   EXPO_PUBLIC_APP_VARIANT=passenger → "ToGo"        (app.togo.mobile)  passengers only
//   EXPO_PUBLIC_APP_VARIANT=staff     → "ToGo Staff"  (app.togo.staff)   crew + operations only
//   unset / "combined"                → development build with every space, so a
//                                       single phone can demo the whole loop.
//
// The variant is also read at runtime (src/env.ts) to decide which spaces exist.
module.exports = ({ config }) => {
  const variant = (process.env.EXPO_PUBLIC_APP_VARIANT || 'combined').trim();
  const base = { ...config, extra: { ...config.extra, appVariant: variant } };
  if (variant !== 'staff') return base;
  return {
    ...base,
    name: 'ToGo Staff',
    slug: 'togo-staff',
    scheme: 'togostaff',
    ios: { ...config.ios, bundleIdentifier: 'app.togo.staff' },
    android: { ...config.android, package: 'app.togo.staff' },
  };
};
