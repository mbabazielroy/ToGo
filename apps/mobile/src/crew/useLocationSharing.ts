import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useAdapter, useAppMode } from '@/data/AdapterProvider';

export type SharingState =
  | { kind: 'simulated' }
  | { kind: 'off' }
  | { kind: 'asking' }
  | { kind: 'denied' }
  | { kind: 'sharing'; lastSentAt: Date | null; accuracyM: number | null }
  | { kind: 'error'; message: string };

/**
 * Foreground location sharing for the driver's running trip (connected mode only).
 * Sends a fix every ~30 s or 50 m while this screen is mounted; stops when the trip
 * stops running or the driver leaves the screen. No background tracking.
 */
export function useLocationSharing(tripId: string | undefined, running: boolean): SharingState {
  const adapter = useAdapter();
  const mode = useAppMode();
  const [state, setState] = useState<SharingState>(mode === 'demo' ? { kind: 'simulated' } : { kind: 'off' });
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (mode === 'demo') { setState({ kind: 'simulated' }); return; }
    if (!tripId || !running) { setState({ kind: 'off' }); return; }
    let cancelled = false;
    (async () => {
      setState({ kind: 'asking' });
      const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (cancelled) return;
      if (!perm || perm.status !== 'granted') { setState({ kind: 'denied' }); return; }
      setState({ kind: 'sharing', lastSentAt: null, accuracyM: null });
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
        (pos) => {
          const accuracy = pos.coords.accuracy ?? null;
          adapter.reportLocation(tripId, pos.coords.latitude, pos.coords.longitude, accuracy, new Date(pos.timestamp).toISOString())
            .then(() => { if (!cancelled) setState({ kind: 'sharing', lastSentAt: new Date(), accuracyM: accuracy }); })
            .catch((e: unknown) => { if (!cancelled) setState({ kind: 'error', message: (e as Error)?.message ?? 'Could not send location' }); });
        },
      ).catch(() => null);
      if (cancelled) sub.current?.remove();
    })();
    return () => { cancelled = true; sub.current?.remove(); sub.current = null; };
  }, [adapter, mode, tripId, running]);

  return state;
}
