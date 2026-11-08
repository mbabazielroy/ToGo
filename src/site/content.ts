// Settings the info site reads at build time. The same EXPO_PUBLIC_* names as the
// phone apps and the legal pages, so one set of values fills all three.
const env = import.meta.env;

export const SUPPORT_EMAIL = (env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();
export const LEGAL_NAME = (env.EXPO_PUBLIC_LEGAL_NAME ?? '').trim();
/** Store links. Until they are set, the site says the apps are coming soon. */
export const APP_STORE_URL = (env.EXPO_PUBLIC_APP_STORE_URL ?? '').trim();
export const PLAY_STORE_URL = (env.EXPO_PUBLIC_PLAY_STORE_URL ?? '').trim();
