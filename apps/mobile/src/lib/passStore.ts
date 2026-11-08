import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePasses, prunePasses, syncPasses, upsertPass, type SavedPasses } from './savedPasses';
import type { BookingView, TripView } from '@shared/data/adapter';
import { reported } from './crashReporting';

// The phone's copy of upcoming boarding passes (connected mode only; the preview
// runs on the phone already). App-sandbox storage, the same place the app keeps its
// other settings. It holds what the boarding pass screen shows: the booking
// reference, boarding code, pickup and trip details. It is cleared on sign-out,
// account deletion and "Start fresh", and passes expire 12 hours after pickup.

const KEY = 'togo.passes.v1';

let cache: SavedPasses | null = null;
const listeners = new Set<(s: SavedPasses) => void>();
// Writes run one after another so a slow read can't overwrite a newer write.
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<SavedPasses> {
  if (cache) return cache;
  cache = prunePasses(parsePasses(await AsyncStorage.getItem(KEY).catch(() => null)));
  return cache;
}

function write(update: (s: SavedPasses) => SavedPasses): Promise<void> {
  const run = queue.then(async () => {
    const next = update(await read());
    cache = next;
    listeners.forEach((l) => l(next));
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(reported('save-passes'));
  });
  queue = run.catch(() => {});
  return run.catch(() => {});
}

export function savePasses(bookings: BookingView[], trips: (TripView | null)[]): Promise<void> {
  return write((s) => syncPasses(s, bookings, trips));
}

export function savePass(booking: BookingView, trip: TripView | null): Promise<void> {
  return write((s) => upsertPass(s, booking, trip));
}

export function clearSavedPasses(): Promise<void> {
  return write(() => ({})).then(() => AsyncStorage.removeItem(KEY).catch(() => {}));
}

/** The saved passes, kept up to date as they change. */
export function useSavedPasses(): SavedPasses | null {
  const [state, setState] = useState<SavedPasses | null>(cache);
  useEffect(() => {
    let live = true;
    read().then((s) => { if (live) setState(s); }).catch(() => { if (live) setState({}); });
    listeners.add(setState);
    return () => { live = false; listeners.delete(setState); };
  }, []);
  return state;
}
