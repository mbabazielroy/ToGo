import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

/**
 * Handles auth callback deep links (email confirmation / password recovery) on
 * native. Supabase's web `detectSessionInUrl` does not apply on native, so we parse
 * the incoming URL ourselves.
 *
 * IMPORTANT (honesty): this path is implemented but UNVERIFIED in this environment.
 * It only works once (a) the app is opened via its `togo://` scheme or a configured
 * https deep link, and (b) the Supabase project's Redirect URLs include that scheme
 * — which in turn generally requires a development build, not plain Expo Go. See
 * docs/MOBILE.md. No claim is made that callbacks were tested on a device.
 */
export function useAuthDeepLinks() {
  const { setRecoveryMode, refresh } = useAuth();

  useEffect(() => {
    if (!supabase) return;

    async function handle(url: string | null) {
      if (!url || !supabase) return;
      const parsed = Linking.parse(url);
      const qp = (parsed.queryParams ?? {}) as Record<string, string | string[] | undefined>;
      const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

      // Fragment params (implicit flow) come through as part of the URL after '#'.
      const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
      const frag = new URLSearchParams(hash);
      const access_token = frag.get('access_token') ?? str(qp.access_token);
      const refresh_token = frag.get('refresh_token') ?? str(qp.refresh_token);
      const type = frag.get('type') ?? str(qp.type);
      const code = str(qp.code);

      try {
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else {
          return;
        }
        if (type === 'recovery') setRecoveryMode(true);
        await refresh();
      } catch {
        // Invalid/expired link — leave the user on the auth screen with no session.
      }
    }

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [setRecoveryMode, refresh]);
}
