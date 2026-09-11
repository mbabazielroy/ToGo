import type { ManifestRow, HubExpectedRow } from '@shared/data/adapter';

export interface PaxCounts { expected: number; checkedIn: number; boarded: number }

/** Passenger (seat) counts for a trip manifest — not just booking counts. */
export function manifestCounts(rows: ManifestRow[]): PaxCounts {
  let expected = 0, checkedIn = 0, boarded = 0;
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    if (r.status === 'reserved' || r.status === 'checked_in' || r.status === 'boarded') expected += r.seats;
    if (r.status === 'checked_in' || r.status === 'boarded' || r.status === 'completed') checkedIn += r.seats;
    if (r.status === 'boarded' || r.status === 'completed') boarded += r.seats;
  }
  return { expected, checkedIn, boarded };
}

/** Seat counts for a hub's expected passengers (attendant view). */
export function hubCounts(rows: HubExpectedRow[]): { expected: number; checkedIn: number } {
  let expected = 0, checkedIn = 0;
  for (const r of rows) {
    if (r.status === 'reserved' || r.status === 'checked_in' || r.status === 'boarded') expected += r.seats;
    if (r.status === 'checked_in' || r.status === 'boarded') checkedIn += r.seats;
  }
  return { expected, checkedIn };
}
