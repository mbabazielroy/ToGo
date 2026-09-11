import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './env';

// A single shared client, created only when configured. In demo mode this is null
// and the app never touches the network.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Narrowing helper: throws if called in demo mode (guards connected-only paths). */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured — this action requires connected mode.');
  }
  return supabase;
}

/**
 * Light reachability probe: reads a public view (anon-readable) with a HEAD count.
 * Any error (network, 4xx, missing schema) means the connected backend is not usable.
 */
export async function pingSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  try {
    const { error } = await supabase.from('hubs_public').select('id', { head: true, count: 'exact' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'unreachable' };
  }
}
