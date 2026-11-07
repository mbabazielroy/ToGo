import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAdapter, useAppMode, useDataEpoch } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession } from '@/session/SessionProvider';
import { planReminders } from '@/lib/reminders';
import { reportError } from '@/lib/crashReporting';

// On-device reminders for the passenger's own trips: "check-in is open" (2 h before
// pickup) and "time to head to your hub" (30 min before). They are scheduled on the
// phone from the bookings the app already loads, so they need no push server, and
// they are cleared when the trip is cancelled, the account signs out, or Boarding
// reminders is turned off. Delay alerts stay in-app (they need push, a later phase).

const PREFIX = 'togo-';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function clearOurs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Mounted once in the passenger space; renders nothing. */
export function PickupReminders() {
  const adapter = useAdapter();
  const mode = useAppMode();
  const epoch = useDataEpoch();
  const { session } = useAuth();
  const { profile } = useSession();
  const router = useRouter();
  const signedIn = mode === 'demo' || !!session;
  const enabled = profile.notifyBoarding && signedIn;

  // Tapping a reminder opens that boarding pass.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const bookingId = r.notification.request.content.data?.bookingId;
      if (typeof bookingId === 'string') router.push(`/trip/${bookingId}`);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        if (!enabled) { await clearOurs(); return; }
        const [bookings, hubs] = await Promise.all([adapter.myBookings(), adapter.listHubs()]);
        const plan = planReminders(bookings, hubs, true);
        if (cancelled) return;
        if (plan.length === 0) { await clearOurs(); return; }

        // Ask only once the passenger has a trip to be reminded about.
        let perm = await Notifications.getPermissionsAsync();
        if (perm.status === 'undetermined' && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
        if (cancelled || perm.status !== 'granted') return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('trip-reminders', {
            name: 'Trip reminders',
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        await clearOurs();
        for (const r of plan) {
          await Notifications.scheduleNotificationAsync({
            identifier: r.id,
            content: { title: r.title, body: r.body, data: { bookingId: r.bookingId } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: 'trip-reminders' },
          });
        }
      } catch (e) {
        // Reminders are a convenience: never break the app over them, but report it.
        reportError(e, 'reminders');
      }
    })();
    return () => { cancelled = true; };
  }, [adapter, enabled, epoch]);

  return null;
}
