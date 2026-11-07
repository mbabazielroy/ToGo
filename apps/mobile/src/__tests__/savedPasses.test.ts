import { describe, it, expect } from 'vitest';
import type { BookingView, TripView } from '@shared/data/adapter';
import { keepPass, listPasses, parsePasses, prunePasses, syncPasses, upsertPass, MAX_SAVED, type SavedPasses } from '../lib/savedPasses';

const now = new Date('2026-09-10T06:00:00+03:00');

function booking(over: Partial<BookingView> = {}): BookingView {
  return {
    id: 'b1', tripId: 't1', reference: 'ABC', boardingCredential: 'K7P2Q9', seats: 1,
    status: 'reserved', paymentStatus: 'unpaid', fareUgxSnapshot: 30000,
    pickupHubId: 'h1', dropoffHubId: 'h2', pickupTimeSnapshot: '2026-09-10T10:00:00+03:00',
    dropoffTimeSnapshot: '2026-09-10T14:00:00+03:00', passengerName: 'A',
    unresolved: false, createdAt: '2026-09-09T10:00:00+03:00', ...over,
  };
}

function trip(id = 't1'): TripView {
  return {
    id, operatorId: 'o1', operatorName: 'Op', direction: 'KLA_MBR', serviceDate: '2026-09-10',
    originDeparture: '2026-09-10T09:30:00+03:00', destinationArrival: '2026-09-10T14:30:00+03:00',
    fareUgx: 30000, capacity: 40, status: 'scheduled', delayMinutes: 0, progress: 0,
    lastUpdate: '2026-09-10T05:00:00+03:00', seatsReserved: 1, seatsAvailable: 39, stops: [],
  } as TripView;
}

describe('saved boarding passes', () => {
  it('keeps upcoming passes until 12 hours after pickup', () => {
    expect(keepPass(booking(), now)).toBe(true);
    expect(keepPass(booking({ status: 'boarded' }), new Date('2026-09-10T21:00:00+03:00'))).toBe(true);
    expect(keepPass(booking(), new Date('2026-09-10T22:30:00+03:00'))).toBe(false);
    for (const status of ['cancelled', 'completed', 'missed_pickup', 'no_show'] as const) {
      expect(keepPass(booking({ status }), now)).toBe(false);
    }
  });

  it('syncs to the fresh list, dropping bookings no longer there', () => {
    const before: SavedPasses = { old: { booking: booking({ id: 'old' }), trip: null, savedAt: now.toISOString() } };
    const next = syncPasses(before, [booking(), booking({ id: 'b2', status: 'cancelled' })], [trip()], now);
    expect(Object.keys(next)).toEqual(['b1']);
    expect(next.b1.trip?.id).toBe('t1');
    expect(next.b1.savedAt).toBe(now.toISOString());
  });

  it('keeps the earlier trip details when the trip failed to load', () => {
    const before = syncPasses({}, [booking()], [trip()], now);
    const next = syncPasses(before, [booking({ status: 'checked_in' })], [null], now);
    expect(next.b1.booking.status).toBe('checked_in');
    expect(next.b1.trip?.id).toBe('t1');
  });

  it('upserts one pass and removes it once cancelled', () => {
    const one = upsertPass({}, booking(), trip(), now);
    expect(Object.keys(one)).toEqual(['b1']);
    expect(upsertPass(one, booking({ status: 'cancelled' }), null, now)).toEqual({});
  });

  it('keeps at most the soonest passes, in pickup order', () => {
    const many = Array.from({ length: MAX_SAVED + 5 }, (_, i) =>
      booking({ id: `b${i}`, pickupTimeSnapshot: new Date(now.getTime() + (MAX_SAVED + 5 - i) * 3600_000).toISOString() }));
    const list = listPasses(syncPasses({}, many, [], now), now);
    expect(list).toHaveLength(MAX_SAVED);
    expect(list[0].booking.id).toBe(`b${MAX_SAVED + 4}`);
    const times = list.map((p) => p.booking.pickupTimeSnapshot);
    expect([...times].sort()).toEqual(times);
  });

  it('reads stored data defensively', () => {
    const good = prunePasses(syncPasses({}, [booking()], [trip()], now), now);
    expect(parsePasses(JSON.stringify(good))).toEqual(good);
    expect(parsePasses(null)).toEqual({});
    expect(parsePasses('not json')).toEqual({});
    expect(parsePasses('[1,2]')).toEqual({});
    expect(parsePasses(JSON.stringify({ x: { booking: { id: 'y' }, savedAt: 'z' } }))).toEqual({});
  });
});
