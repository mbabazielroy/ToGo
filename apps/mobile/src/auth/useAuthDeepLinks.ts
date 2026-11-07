import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { parseAuthLink } from './authLink';

/**
 * Handles sign-in links (email confirmation and password reset) opened in the app.
 * Supabase's web `detectSessionInUrl` does not apply on native, so the incoming
 * URL is read here. Only PKCE `?code=` links are accepted; see authLink.ts for why.
 *
 * Not yet tested on a device: links need the `togo://` scheme in the Supabase
 * project's Redirect URLs and a development or store build (not Expo Go). See
 * docs/MOBILE.md.
 */
export function useAuthDeepLinks() {
  const { setRecoveryMode, refresh } = useAuth();

  useEffect(() => {
    if (!supabase) return;

    async function handle(url: string | null) {
      const link = parseAuthLink(url);
      if (!link || !supabase) return;
      try {
        // Fails unless this phone holds the matching code verifier.
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        if (error) return;
        // Supabase also emits PASSWORD_RECOVERY for reset links (AuthProvider
        // listens for it); the path check covers the same case.
        if (link.recovery) setRecoveryMode(true);
        await refresh();
      } catch {
        // Invalid, expired or already-used link: stay signed out.
      }
    }

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [setRecoveryMode, refresh]);
}
