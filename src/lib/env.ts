// Runtime configuration. The app runs in one of two modes:
//   - 'demo'      : no Supabase configured — fully usable local prototype.
//   - 'connected' : Supabase URL + publishable (anon) key present — real backend.
//
// Only the PUBLIC url and publishable/anon key are ever read here. A service-role
// key must NEVER be placed in a VITE_ variable — it would be bundled to the client.

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

/** True when a Supabase backend is configured. */
export const isSupabaseConfigured: boolean =
  url.startsWith('http') && anonKey.length > 20;

export type AppMode = 'demo' | 'connected';

export const APP_MODE: AppMode = isSupabaseConfigured ? 'connected' : 'demo';

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
