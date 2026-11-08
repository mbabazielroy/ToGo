import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAdapter, useAppMode } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession } from '@/session/SessionProvider';
import { keepPass } from '@/lib/savedPasses';
import { registerForPush, unregisterFromPush } from './push';
import { reportError } from '@/lib/crashReporting';

/**
 * Turns push alerts on for this phone while the passenger is signed in, has
 * "Delays and changes" on and has an upcoming trip, and off when they turn the
 * setting off. Permission is asked only once there is a trip to be told about.
 * Mounted once in the passenger space; renders nothing. Connected mode only.
 */
export function PushRegistration() {
  const adapter = useAdapter();
  const mode = useAppMode();
  const { session } = useAuth();
  const { profile } = useSession();
  const userId = session?.user?.id;
  const wanted = profile.notifyDelays;

  useEffect(() => {
    if (Platform.OS === 'web' || mode !== 'connected' || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        if (!wanted) { await unregisterFromPush(); return; }
        let perm = await Notifications.getPermissionsAsync();
        if (perm.status === 'undetermined' && perm.canAskAgain) {
          const upcoming = (await adapter.myBookings()).some((b) => keepPass(b));
          if (!upcoming || cancelled) return;
          perm = await Notifications.requestPermissionsAsync();
        }
        if (cancelled || perm.status !== 'granted') return;
        await registerForPush();
      } catch (e) {
        reportError(e, 'push');
      }
    })();
    return () => { cancelled = true; };
  }, [adapter, mode, userId, wanted]);

  return null;
}
