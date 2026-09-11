// Runtime configuration. The app runs in one of two modes:
//   - 'demo'      : no Supabase configured — fully usable local prototype.
//   - 'connected' : Supabase URL + publishable (anon) key present — real backend.
//
// Only the PUBLIC url and publishable/anon key are ever read here. A service-role
// key must NEVER be placed in a VITE_ variable — it would be bundled to the client.

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const demoFlag = (import.meta.env.VITE_TOGO_DEMO ?? '').trim().toLowerCase();

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

/** True when a Supabase backend is configured. */
export const isSupabaseConfigured: boolean =
  url.startsWith('http') && anonKey.length > 20;

/** Demo fixtures are enabled only by an explicit development/test flag. */
export const DEMO_ENABLED: boolean = demoFlag === '1' || demoFlag === 'true';

export type AppMode = 'demo' | 'connected';

// Normal entry = connected; the local demo prototype is opt-in only. When connected
// mode is intended but unconfigured/unreachable, AppRoot shows a setup/connection
// screen — it never silently opens demo mode.
export const APP_MODE: AppMode = DEMO_ENABLED ? 'demo' : 'connected';

// Defensive: catch an accidentally-exposed service role key at dev time.
if (
  isSupabaseConfigured &&
  /service_role/i.test(anonKey)
) {
  // eslint-disable-next-line no-console
  console.error(
    '[ToGo] Refusing to use a service_role key in the browser. Use the publishable/anon key only.',
  );
}
