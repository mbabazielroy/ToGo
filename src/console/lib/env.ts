// Operations console configuration. Only the PUBLIC Supabase URL and the
// publishable (anon) key are read here. A service-role key must NEVER be placed in
// a VITE_ variable: it would be bundled into the page.

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

/** True when a Supabase backend is configured. */
export const isSupabaseConfigured: boolean = url.startsWith('http') && anonKey.length > 20 && !/service_role/i.test(anonKey);
