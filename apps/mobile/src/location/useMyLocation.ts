import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import type { LatLng } from '@shared/data/geo';
import { reportError } from '../lib/crashReporting';

export type MyLocationStatus = 'off' | 'asking' | 'on' | 'denied' | 'error';

/** What `enable()` found: a first fix (may be null without signal), or a refusal. */
export interface EnableResult { coord: LatLng | null; denied: boolean }

export interface MyLocation {
  /** The phone's latest position, or null until there is one. */
  coord: LatLng | null;
  status: MyLocationStatus;
  /** Ask for permission if needed and start following; resolves with a first fix. */
  enable: () => Promise<EnableResult>;
}

// The last position, kept in memory only so the next map shows the dot at once.
// It is never saved or sent anywhere.
let lastKnown: LatLng | null = null;

const toLatLng = (p: Location.LocationObject): LatLng => ({ latitude: p.coords.latitude, longitude: p.coords.longitude });

/**
 * The passenger's own position, for drawing "you are here" on a map.
 *
 * - Follows the phone only while the screen is open and the app is in front; it
 *   stops on leaving the screen or the app. There is no background tracking.
 * - Starts by itself only when location is already allowed. Otherwise nothing is
 *   asked until the passenger taps a button that calls `enable()`.
 * - The position stays on the phone (it is not sent to ToGo).
 */
export function useMyLocation(): MyLocation {
  const [coord, setCoord] = useState<LatLng | null>(lastKnown);
  const [status, setStatus] = useState<MyLocationStatus>('off');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Already allowed (on a previous visit or in another screen): follow at once.
    Location.getForegroundPermissionsAsync()
      .then((p) => { if (mounted.current && p.status === 'granted') setStatus((s) => (s === 'off' ? 'on' : s)); })
      .catch(() => {});
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => { mounted.current = false; sub.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const following = status === 'on' && focused && active;
  useEffect(() => {
    if (!following) return;
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      (pos) => {
        if (cancelled) return;
        lastKnown = toLatLng(pos);
        setCoord(lastKnown);
      },
    ).then((s) => { if (cancelled) s.remove(); else sub = s; })
      .catch((e: unknown) => {
        reportError(e, 'my-location');
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; sub?.remove(); };
  }, [following]);

  const enable = useCallback(async (): Promise<EnableResult> => {
    setStatus('asking');
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!perm || perm.status !== 'granted') {
      if (mounted.current) setStatus('denied');
      return { coord: null, denied: true };
    }
    if (mounted.current) setStatus('on');
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lastKnown = toLatLng(pos);
      if (mounted.current) setCoord(lastKnown);
      return { coord: lastKnown, denied: false };
    } catch (e) {
      // The watcher may still get a fix (e.g. once outside); report only real faults.
      reportError(e, 'my-location-first-fix');
      return { coord: lastKnown, denied: false };
    }
  }, []);

  return { coord: status === 'on' || status === 'asking' ? coord : null, status, enable };
}
