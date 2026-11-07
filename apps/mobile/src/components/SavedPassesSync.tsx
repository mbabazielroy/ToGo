import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAdapter, useAppMode } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { savePasses } from '@/lib/passStore';
import { keepPass } from '@/lib/savedPasses';
import { reportError } from '@/lib/crashReporting';

/**
 * Keeps the phone's copy of upcoming boarding passes fresh while there is signal,
 * so they can still be shown at a hub without it. Refreshes when the passenger
 * space opens, when the app returns to the foreground, and when bookings change.
 * Mounted once in the passenger space; renders nothing. Connected mode only.
 */
export function SavedPassesSync() {
  const adapter = useAdapter();
  const mode = useAppMode();
  const { session } = useAuth();
  const userId = session?.user?.id;

  useEffect(() => {
    // No session yet (still restoring, or signed out): leave the saved copy alone.
    // Signing out and deleting the account clear it (SessionProvider).
    if (mode !== 'connected' || !userId) return;
    let live = true;
    let running = false;

    async function refresh() {
      if (running) return;
      running = true;
      try {
        const bookings = await adapter.myBookings();
        const upcoming = bookings.filter((b) => keepPass(b));
        const tripIds = [...new Set(upcoming.map((b) => b.tripId))];
        const trips = await Promise.all(tripIds.map((id) => adapter.getTrip(id).catch(() => null)));
        if (live) await savePasses(bookings, trips);
      } catch (e) {
        // Offline or a server error: keep the passes saved last time.
        // (Lost connections are not reported; other failures are.)
        reportError(e, 'saved-passes');
      } finally {
        running = false;
      }
    }

    refresh();
    const sub = adapter.subscribeMyBookings(() => { refresh(); });
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { live = false; sub.unsubscribe(); app.remove(); };
  }, [adapter, mode, userId]);

  return null;
}
