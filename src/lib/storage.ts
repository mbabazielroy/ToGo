import type { AppState } from '../types';
import { buildSeedState, STORAGE_VERSION } from '../data/seed';
import { kampalaToday } from './time';

const KEY = 'togo.demo.state';

/** Basic structural validation so we recover gracefully from malformed data. */
function isValidState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<AppState>;
  return (
    typeof s.version === 'number' &&
    Array.isArray(s.hubs) &&
    Array.isArray(s.operators) &&
    Array.isArray(s.trips) &&
    Array.isArray(s.bookings) &&
    Array.isArray(s.activity) &&
    typeof s.role === 'string'
  );
}

/** Load persisted state, or fall back to a fresh seed on any problem. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return buildSeedState(kampalaToday());
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidState(parsed)) {
      // Malformed shape — reseed rather than crash.
      return buildSeedState(kampalaToday());
    }
    if (parsed.version !== STORAGE_VERSION) {
      // Version mismatch: migrate by reseeding demo data but keep the chosen role.
      const fresh = buildSeedState(kampalaToday());
      fresh.role = parsed.role ?? fresh.role;
      return fresh;
    }
    return parsed;
  } catch {
    return buildSeedState(kampalaToday());
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode write failures — demo still works in-memory.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
