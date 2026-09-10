import { describe, it, expect, beforeEach } from 'vitest';
import { buildSeedState } from './seed';
import { DemoAdapter } from './demoAdapter';
import { AdapterError, type TripView } from './adapter';

const TODAY = '2026-09-10';

function makeAdapter() {
  return DemoAdapter.withState(buildSeedState(TODAY));
}

async function firstTrip(a: DemoAdapter): Promise<TripView> {
  const trips = await a.searchTrips({ direction: 'KLA_MBR', date: TODAY });
  return trips[0];
}

let a: DemoAdapter;
beforeEach(() => { a = makeAdapter(); });

describe('DemoAdapter — parity with connected business rules', () => {
  it('reserve decreases availability by the seat count', async () => {
    const t = await firstTrip(a);
    const before = t.seatsAvailable;
    const stops = t.stops;
    const b = await a.reserve({
      tripId: t.id, pickupStopId: stops[0].id, dropoffStopId: stops[stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k1',
    });
    expect(b.reference).toMatch(/^TG-/);
    const after = await a.getTrip(t.id);
    expect(after!.seatsAvailable).toBe(before - 2);
  });

  it('prevents overbooking beyond capacity', async () => {
    const t = await firstTrip(a);
    await expect(a.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: t.capacity + 1, passengerName: 'Big', idempotencyKey: 'k2',
    })).rejects.toBeInstanceOf(AdapterError);
  });

  it('cancellation restores capacity exactly once', async () => {
    const t = await firstTrip(a);
    const before = t.seatsAvailable;
    const b = await a.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k3',
    });
    await a.cancelBooking(b.id);
    await a.cancelBooking(b.id); // idempotent
    const after = await a.getTrip(t.id);
    expect(after!.seatsAvailable).toBe(before);
  });

  it('full boarding flow: reserve → check in → board → complete', async () => {
    const t = await firstTrip(a);
    const b = await a.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k4',
    });
    await a.checkIn(b.id);
    const manifest = await a.getTripManifest(t.id);
    expect(manifest.find((m) => m.bookingId === b.id)!.status).toBe('checked_in');
    await a.boardByCredential(t.id, b.boardingCredential);
    const boarded = await a.getBooking(b.id);
    expect(boarded!.status).toBe('boarded');
    await a.updateTripStatus(t.id, 'completed');
    const done = await a.getBooking(b.id);
    expect(done!.status).toBe('completed');
  });

  it('rejects invalid and reused boarding credentials', async () => {
    const t = await firstTrip(a);
    const b = await a.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 1, passengerName: 'Amina', idempotencyKey: 'k5',
    });
    await expect(a.boardByCredential(t.id, 'not-a-code')).rejects.toBeInstanceOf(AdapterError);
    await a.boardByCredential(t.id, b.boardingCredential);
    // Double board rejected.
    await expect(a.boardByCredential(t.id, b.boardingCredential)).rejects.toBeInstanceOf(AdapterError);
  });

  it('capacity cannot be lowered below active reservations', async () => {
    const t = await firstTrip(a);
    await a.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 5, passengerName: 'Group', idempotencyKey: 'k6',
    });
    await expect(a.operatorUpdateTrip(t.id, { capacity: 3 })).rejects.toBeInstanceOf(AdapterError);
    const ok = await a.operatorUpdateTrip(t.id, { capacity: 10 });
    expect(ok.capacity).toBe(10);
  });
});
