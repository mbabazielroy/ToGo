import { describe, it, expect, vi } from 'vitest';
import { DemoAdapter } from '@shared/data/demoAdapter';
import { buildSeedState } from '@shared/data/seed';
import { kampalaToday } from '@shared/lib/time';
import type { AppState } from '@shared/types';

// The mobile app reuses the SAME shared demo business rules (@shared) and injects a
// native persistence sink (AsyncStorage on device). Here we inject an in-memory
// sink to prove both: the rules run, and every mutation persists.
function makeAdapter() {
  const store: { state: AppState | null } = { state: null };
  const persist = vi.fn((s: AppState) => { store.state = s; });
  const adapter = new DemoAdapter(buildSeedState(kampalaToday()), persist);
  return { adapter, persist, store };
}

async function firstTrip(a: DemoAdapter) {
  const trips = await a.searchTrips({ direction: 'KLA_MBR', date: kampalaToday() });
  return trips[0];
}

describe('mobile demo adapter — shared rules + native persistence sink', () => {
  it('reserve decreases availability and persists to the injected sink', async () => {
    const { adapter, persist } = makeAdapter();
    const t = await firstTrip(adapter);
    const before = t.seatsAvailable;
    const b = await adapter.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k1',
    });
    expect(b.reference).toMatch(/^TG-/);
    const after = await adapter.getTrip(t.id);
    expect(after!.seatsAvailable).toBe(before - 2);
    expect(persist).toHaveBeenCalled(); // native storage sink invoked
  });

  it('cancellation restores capacity exactly once', async () => {
    const { adapter } = makeAdapter();
    const t = await firstTrip(adapter);
    const before = t.seatsAvailable;
    const b = await adapter.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k2',
    });
    await adapter.cancelBooking(b.id);
    await adapter.cancelBooking(b.id); // idempotent
    expect((await adapter.getTrip(t.id))!.seatsAvailable).toBe(before);
  });

  it('classifies outcomes at completion: checked-in→missed_pickup, reserved→not_boarded', async () => {
    const { adapter } = makeAdapter();
    const t = await firstTrip(adapter);
    const checked = await adapter.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 1, passengerName: 'Checked', idempotencyKey: 'c1',
    });
    const reservedOnly = await adapter.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 1, passengerName: 'Reserved', idempotencyKey: 'r1',
    });
    await adapter.checkIn(checked.id);
    await adapter.updateTripStatus(t.id, 'completed');
    expect((await adapter.getBooking(checked.id))!.status).toBe('missed_pickup');
    expect((await adapter.getBooking(reservedOnly.id))!.status).toBe('not_boarded');
  });

  it('boarding by opaque credential works and is single-use', async () => {
    const { adapter } = makeAdapter();
    const t = await firstTrip(adapter);
    const b = await adapter.reserve({
      tripId: t.id, pickupStopId: t.stops[0].id, dropoffStopId: t.stops[t.stops.length - 1].id,
      seats: 1, passengerName: 'Rider', idempotencyKey: 'b1',
    });
    await adapter.checkIn(b.id);
    await adapter.boardByCredential(t.id, b.boardingCredential);
    expect((await adapter.getBooking(b.id))!.status).toBe('boarded');
    await expect(adapter.boardByCredential(t.id, b.boardingCredential)).rejects.toBeTruthy();
  });
});
