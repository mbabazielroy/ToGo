import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from '@shared/types';
import { buildSeedState, STORAGE_VERSION } from '@shared/data/seed';
import { kampalaToday } from '@shared/lib/time';

// Native demo persistence. This is ORDINARY app-sandbox storage (unencrypted) and
// only ever holds fictional demo data — never a real session or credentials.
const KEY = 'togo.mobile.demo.v1';

function isValid(v: unknown): v is AppState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<AppState>;
  return (
    typeof s.version === 'number' &&
    Array.isArray(s.hubs) && Array.isArray(s.trips) && Array.isArray(s.bookings) &&
    Array.isArray(s.activity) && typeof s.role === 'string'
  );
}

export async function loadDemoState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return buildSeedState(kampalaToday());
    const parsed = JSON.parse(raw) as unknown;
    if (!isValid(parsed)) return buildSeedState(kampalaToday());
    if (parsed.version !== STORAGE_VERSION) return buildSeedState(kampalaToday());
    return parsed;
  } catch {
    return buildSeedState(kampalaToday());
  }
}

/** Fire-and-forget save (the adapter keeps authoritative state in memory). */
export function saveDemoState(state: AppState): void {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export async function clearDemoState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
