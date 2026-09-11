// Runtime mode selection for the mobile app.
//
// The NORMAL entry point is CONNECTED mode (real Supabase auth + shared data).
// Demo mode is a development/test-only fixture and must be opted into explicitly
// with EXPO_PUBLIC_TOGO_DEMO=1 — it is never the silent fallback for a missing or
// unreachable backend. When connected mode is intended but the configuration is
// missing or the service is unavailable, the app shows a setup/connection screen
// (see AdapterProvider), it does NOT quietly open demo mode.
//
// EXPO_PUBLIC_* values are inlined into the JS bundle at build time and are PUBLIC.
// Only the project URL and the publishable/anon key belong here — never a
// service_role key or any privileged secret.
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const demoFlag = (process.env.EXPO_PUBLIC_TOGO_DEMO ?? '').trim().toLowerCase();

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

/** True when a Supabase backend is configured (public URL + publishable key). */
export const isSupabaseConfigured: boolean = url.startsWith('http') && anonKey.length > 20;

/** Demo fixtures are enabled only by an explicit development/test flag. */
export const DEMO_ENABLED: boolean = demoFlag === '1' || demoFlag === 'true';

export type AppMode = 'demo' | 'connected';

/** Normal entry = connected; demo only via the explicit dev/test flag. */
export const APP_MODE: AppMode = DEMO_ENABLED ? 'demo' : 'connected';

// Defensive: refuse an obviously-privileged key in a public var.
if (isSupabaseConfigured && /service_role/i.test(anonKey)) {
  // eslint-disable-next-line no-console
  console.error('[ToGo] Refusing a service_role key in EXPO_PUBLIC_*. Use the publishable/anon key only.');
}
