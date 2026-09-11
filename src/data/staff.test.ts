import { describe, it, expect, beforeEach } from 'vitest';
import { buildSeedState } from './seed';
import { DemoAdapter } from './demoAdapter';
import { AdapterError, type TripView } from './adapter';

const TODAY = '2026-09-11';

function makeAdapter() {
  return DemoAdapter.withState(buildSeedState(TODAY));
}
async function savannahTrip(a: DemoAdapter): Promise<TripView> {
  const trips = await a.searchTrips({ direction: 'KLA_MBR', date: TODAY });
  return trips.find((t) => t.operatorId === 'op_savannah')!;
}

let a: DemoAdapter;
beforeEach(() => { a = makeAdapter(); });

describe('staff personas & assignments (preview)', () => {
  it('seeds staff with role-based assignments', async () => {
    const staff = await a.listStaff();
    expect(staff.some((s) => s.role === 'driver')).toBe(true);
    expect(staff.some((s) => s.role === 'conductor')).toBe(true);
    expect(staff.some((s) => s.role === 'attendant')).toBe(true);
    const conSav = staff.find((s) => s.id === 'staff_con_sav')!;
    expect(conSav.role).toBe('conductor');
    expect(conSav.assignedTripCount).toBeGreaterThan(0);
    expect(await a.attendantHubId('staff_att_kla')).toBe('hub_kla_nakawa');
  });

  it('staffTrips returns a conductor’s assigned trips with driver/conductor names', async () => {
    const trips = await a.staffTrips('staff_con_sav');
    expect(trips.length).toBeGreaterThan(0);
    const t = trips[0];
    expect(t.conductorName).toBe('Grace Nakato');
    expect(t.driverName).toBe('Moses Okello');
  });
});

describe('resolve-before-board (conductor)', () => {
  it('resolves a valid code without boarding, then boards on confirm', async () => {
    const t = await savannahTrip(a);
    const stops = [...t.stops].sort((x, y) => x.stopOrder - y.stopOrder);
    const b = await a.reserve({
      tripId: t.id, pickupStopId: stops[0].id, dropoffStopId: stops[stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k1',
    });

    // Resolve does not change status.
    const resolved = await a.resolveBoarding(t.id, b.boardingCredential);
    expect(resolved.reference).toBe(b.reference);
    expect((await a.getBooking(b.id))!.status).toBe('reserved');

    // Boarding on confirm.
    const boarded = await a.boardByCredential(t.id, b.boardingCredential);
    expect(boarded.status).toBe('boarded');

    // Already boarded is rejected by resolve.
    await expect(a.resolveBoarding(t.id, b.boardingCredential)).rejects.toMatchObject({ code: 'ALREADY_BOARDED' });
  });

  it('rejects invalid and wrong-trip codes', async () => {
    const [t1, ...rest] = await a.searchTrips({ direction: 'KLA_MBR', date: TODAY });
    const t2 = rest[0];
    const stops1 = [...t1.stops].sort((x, y) => x.stopOrder - y.stopOrder);
    const b = await a.reserve({
      tripId: t1.id, pickupStopId: stops1[0].id, dropoffStopId: stops1[stops1.length - 1].id,
      seats: 1, passengerName: 'B', idempotencyKey: 'k2',
    });
    await expect(a.resolveBoarding(t1.id, 'NOPE')).rejects.toMatchObject({ code: 'INVALID_CODE' });
    // Same code, different trip → wrong trip.
    await expect(a.resolveBoarding(t2.id, b.boardingCredential)).rejects.toMatchObject({ code: 'WRONG_TRIP' });
  });
});

describe('attendant hub views', () => {
  it('surfaces checked-in passengers and missed-pickup incidents by hub', async () => {
    const t = await savannahTrip(a);
    const stops = [...t.stops].sort((x, y) => x.stopOrder - y.stopOrder);
    const hubId = stops[0].hubId;
    const b = await a.reserve({
      tripId: t.id, pickupStopId: stops[0].id, dropoffStopId: stops[stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k3',
    });
    await a.checkInByReference(b.reference);

    const expected = await a.getHubExpected(hubId);
    expect(expected.find((r) => r.reference === b.reference)!.status).toBe('checked_in');
    expect(await a.hubIncidents(hubId)).toHaveLength(0);

    // Depart the hub leaving the checked-in passenger → flagged unresolved now,
    // resolved to a missed-pickup outcome when the trip completes.
    await a.recordUnresolvedPickup(t.id, hubId, 'Passenger not present at departure');
    expect((await a.hubIncidents(hubId)).some((r) => r.reference === b.reference)).toBe(true);

    await a.updateTripStatus(t.id, 'en_route');
    await a.updateTripStatus(t.id, 'completed');
    expect((await a.getBooking(b.id))!.status).toBe('missed_pickup');
    expect((await a.hubIncidents(hubId)).find((r) => r.reference === b.reference)!.status).toBe('missed_pickup');
  });
});

describe('capacity is restored exactly once on cancellation', () => {
  it('cancel then cancel keeps seats correct', async () => {
    const t = await savannahTrip(a);
    const stops = [...t.stops].sort((x, y) => x.stopOrder - y.stopOrder);
    const before = t.seatsAvailable;
    const b = await a.reserve({
      tripId: t.id, pickupStopId: stops[0].id, dropoffStopId: stops[stops.length - 1].id,
      seats: 2, passengerName: 'Amina', idempotencyKey: 'k4',
    });
    expect((await a.getTrip(t.id))!.seatsAvailable).toBe(before - 2);
    await a.cancelBooking(b.id);
    await a.cancelBooking(b.id);
    expect((await a.getTrip(t.id))!.seatsAvailable).toBe(before);
    expect(() => new AdapterError('X', 'y')).not.toThrow();
  });
});
