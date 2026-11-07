import type { BookingView, TripView } from '@shared/data/adapter';

// Boarding passes kept on the phone so a passenger can show their pass at a hub
// with weak or no signal. This file holds the rules only (what is kept and for how
// long); src/lib/passStore.ts reads and writes them.

export interface SavedPass {
  booking: BookingView;
  trip: TripView | null;
  savedAt: string; // ISO, when this copy was last refreshed from the server
}

export type SavedPasses = Record<string, SavedPass>;

/** Keep a pass until this long after its pickup time. */
export const KEEP_AFTER_PICKUP_MS = 12 * 60 * 60 * 1000;
/** Never keep more than this many passes. */
export const MAX_SAVED = 20;

const KEEP_STATUSES = new Set(['reserved', 'checked_in', 'boarded']);

/** A pass is worth keeping while it can still be shown at the door. */
export function keepPass(b: BookingView, now: Date = new Date()): boolean {
  if (!KEEP_STATUSES.has(b.status)) return false;
  const pickup = new Date(b.pickupTimeSnapshot).getTime();
  return Number.isFinite(pickup) && pickup + KEEP_AFTER_PICKUP_MS > now.getTime();
}

/** Drop expired passes and keep the soonest MAX_SAVED. */
export function prunePasses(store: SavedPasses, now: Date = new Date()): SavedPasses {
  const kept = Object.values(store)
    .filter((p) => keepPass(p.booking, now))
    .sort((a, b) => a.booking.pickupTimeSnapshot.localeCompare(b.booking.pickupTimeSnapshot))
    .slice(0, MAX_SAVED);
  return Object.fromEntries(kept.map((p) => [p.booking.id, p]));
}

/**
 * Replace the saved set with the passenger's full, fresh list of bookings.
 * A booking missing from the list (cancelled elsewhere, or another account's)
 * is dropped. A trip that failed to load keeps the earlier saved copy.
 */
export function syncPasses(
  store: SavedPasses,
  bookings: BookingView[],
  trips: (TripView | null)[],
  now: Date = new Date(),
): SavedPasses {
  const tripById = new Map(trips.filter((t): t is TripView => !!t).map((t) => [t.id, t]));
  const next: SavedPasses = {};
  for (const b of bookings) {
    if (!keepPass(b, now)) continue;
    next[b.id] = { booking: b, trip: tripById.get(b.tripId) ?? store[b.id]?.trip ?? null, savedAt: now.toISOString() };
  }
  return prunePasses(next, now);
}

/** Update one pass after its boarding pass screen loaded it fresh. */
export function upsertPass(
  store: SavedPasses,
  booking: BookingView,
  trip: TripView | null,
  now: Date = new Date(),
): SavedPasses {
  const next = { ...store };
  if (keepPass(booking, now)) {
    next[booking.id] = { booking, trip: trip ?? store[booking.id]?.trip ?? null, savedAt: now.toISOString() };
  } else {
    delete next[booking.id];
  }
  return prunePasses(next, now);
}

/** Saved passes in pickup order, for the My trips list. */
export function listPasses(store: SavedPasses, now: Date = new Date()): SavedPass[] {
  return Object.values(prunePasses(store, now));
}

/** Parse stored JSON, ignoring anything that isn't a saved pass. */
export function parsePasses(raw: string | null): SavedPasses {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: SavedPasses = {};
    for (const [id, p] of Object.entries(v as Record<string, unknown>)) {
      const pass = p as Partial<SavedPass> | null;
      const b = pass?.booking as Partial<BookingView> | undefined;
      if (b && typeof b.id === 'string' && b.id === id && typeof b.boardingCredential === 'string'
        && typeof b.pickupTimeSnapshot === 'string' && typeof pass?.savedAt === 'string') {
        out[id] = { booking: b as BookingView, trip: (pass.trip as TripView | null) ?? null, savedAt: pass.savedAt };
      }
    }
    return out;
  } catch {
    return {};
  }
}
