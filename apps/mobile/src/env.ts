// Runtime mode selection for the mobile app.
//  - 'demo'      : no Supabase configured — fully-usable local prototype.
//  - 'connected' : EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY present.
//
// EXPO_PUBLIC_* values are inlined into the JS bundle at build time and are PUBLIC.
// Only the project URL and the publishable/anon key belong here — never a
// service_role key or any privileged secret.
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export const isSupabaseConfigured: boolean = url.startsWith('http') && anonKey.length > 20;

export type AppMode = 'demo' | 'connected';
export const APP_MODE: AppMode = isSupabaseConfigured ? 'connected' : 'demo';

// Defensive: refuse an obviously-privileged key in a public var.
if (isSupabaseConfigured && /service_role/i.test(anonKey)) {
  // eslint-disable-next-line no-console
  console.error('[ToGo] Refusing a service_role key in EXPO_PUBLIC_*. Use the publishable/anon key only.');
}
