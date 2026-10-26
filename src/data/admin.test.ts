import { describe, it, expect } from 'vitest';
import { DemoAdapter } from './demoAdapter';
import { buildSeedState, rollForward } from './seed';
import { addDays } from '../lib/time';

const TODAY = '2026-09-11';
const fresh = () => DemoAdapter.withState(buildSeedState(TODAY));

describe('admin console (demo adapter)', () => {
  it('lists every departure on a date, both directions', async () => {
    const a = fresh();
    const trips = await a.listTripsOn(TODAY);
    expect(new Set(trips.map((t) => t.direction))).toEqual(new Set(['KLA_MBR', 'MBR_KLA']));
    expect(trips.every((t) => t.serviceDate === TODAY)).toBe(true);
  });

  it('creates a departure from a direction and assigns crew', async () => {
    const a = fresh();
    const t = await a.createDeparture({
      operatorId: 'op_pearl', vehicleId: 'veh_pearl1', direction: 'KLA_MBR', date: TODAY,
      departHHMM: '20:00', durationMin: 240, fareUgx: 28000, driverId: 'staff_drv_pearl', conductorId: 'staff_con_pearl',
    });
    expect(t.driverName).toBe('Isaac Mugisha');
    expect(t.conductorName).toBe('Sarah Auma');
    expect(t.fareUgx).toBe(28000);
  });

  it('assigns and clears crew on an existing departure', async () => {
    const a = fresh();
    const [ankole] = (await a.listTripsOn(TODAY)).filter((t) => t.operatorId === 'op_ankole');
    expect(ankole.driverName).toBeUndefined();
    // A Savannah driver is not on Ankole's crew.
    await expect(a.assignCrew(ankole.id, 'driver', 'staff_drv_sav')).rejects.toThrow(/crew/);
  });

  it('reports cancellations and delays as incidents', async () => {
    const a = fresh();
    const [t1, t2] = await a.listTripsOn(TODAY);
    await a.cancelTrip(t1.id, 'Vehicle unavailable');
    await a.reportDelay(t2.id, 20);
    const kinds = (await a.listIncidents()).map((i) => i.kind);
    expect(kinds).toContain('trip_cancelled');
    expect(kinds).toContain('delay');
  });
});

describe('passenger notifications (demo adapter)', () => {
  it('only include events about the passenger’s own bookings', async () => {
    const a = fresh();
    const [trip] = await a.searchTrips({ direction: 'KLA_MBR', date: TODAY });
    // Operations-only activity: a new departure.
    await a.createDeparture({ operatorId: 'op_pearl', vehicleId: 'veh_pearl1', direction: 'KLA_MBR', date: TODAY, departHHMM: '20:00', durationMin: 240, fareUgx: 28000 });
    expect(await a.listNotifications()).toHaveLength(0);
    expect((await a.listActivity()).length).toBeGreaterThan(0);
    await a.reserve({ tripId: trip.id, pickupStopId: trip.stops[0].id, dropoffStopId: trip.stops[trip.stops.length - 1].id, seats: 1, passengerName: 'Test', idempotencyKey: 'k1' });
    const mine = await a.listNotifications();
    expect(mine.map((n) => n.kind)).toEqual(['reservation']);
  });
});

describe('rollForward', () => {
  it('adds the new day’s departures and crews them, keeping bookings', () => {
    const old = buildSeedState(TODAY);
    old.bookings.push({ id: 'b1', reference: 'TG-1', boardingCode: '1111', tripId: old.trips[0].id, pickupHubId: 'hub_kla_nakawa', passengerName: 'X', seats: 1, status: 'reserved', createdAt: '2026-09-11T05:00:00Z' });
    const next = rollForward(old, addDays(TODAY, 2));
    const newDay = addDays(TODAY, 4);
    expect(next.trips.some((t) => t.date === newDay)).toBe(true);
    expect(next.bookings).toHaveLength(1);
    const driver = next.staff!.find((s) => s.id === 'staff_drv_sav')!;
    expect(driver.assignedTripIds.some((id) => id.endsWith(addDays(TODAY, 2)))).toBe(true);
    // Idempotent, and an admin's crew edits survive the next launch the same day.
    expect(rollForward(next, addDays(TODAY, 2))).toBe(next);
    const edited = { ...next, staff: next.staff!.map((s) => (s.id === 'staff_drv_sav' ? { ...s, assignedTripIds: [] } : s)) };
    expect(rollForward(edited, addDays(TODAY, 2)).staff!.find((s) => s.id === 'staff_drv_sav')!.assignedTripIds).toEqual([]);
  });
});
