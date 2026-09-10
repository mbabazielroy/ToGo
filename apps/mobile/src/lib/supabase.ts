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
