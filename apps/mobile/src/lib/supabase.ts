import 'react-native-url-polyfill/auto'; // Supabase needs a WHATWG URL on RN
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '../env';
import { secureSessionStore } from './secureSessionStore';

// One shared client, created only in connected mode. In demo mode this is null and
// the app never touches the network. The auth session is persisted in the OS
// keychain/keystore via secureSessionStore (see its security notes).
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureSessionStore,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // native deep links are handled explicitly
      },
    })
  : null;

// Pause/resume the token auto-refresh with app foreground state (Supabase RN guidance).
if (supabase) {
  AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') supabase!.auth.startAutoRefresh();
    else supabase!.auth.stopAutoRefresh();
  });
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured — connected mode is unavailable.');
  return supabase;
}

/**
 * A light reachability probe used to distinguish "configured but unreachable/
 * mis-migrated" from "ready". Reads a public view (readable by anon) with a HEAD
 * count so it transfers no rows. Any error (network, 4xx, missing schema) means
 * the connected backend is not usable yet.
 */
export async function pingSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  try {
    const { error } = await supabase
      .from('hubs_public')
      .select('id', { head: true, count: 'exact' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'unreachable' };
  }
}
