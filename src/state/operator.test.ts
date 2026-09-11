import { describe, it, expect, beforeEach } from 'vitest';
import type { AppState } from '../types';
import { buildSeedState } from '../data/seed';
import {
  createTrip,
  assignStaff,
  staffForTrip,
  reserve,
  editTrip,
  getTrip,
} from './logic';

const TODAY = '2026-09-11';

function fresh(): AppState {
  return buildSeedState(TODAY);
}

describe('dispatcher: createTrip', () => {
  let state: AppState;
  beforeEach(() => {
    state = fresh();
  });

  it('creates a scheduled departure with capacity from the vehicle and arrival after departure', () => {
    const r = createTrip(state, {
      operatorId: 'op_savannah',
      routeId: 'route_kla_mbr',
      vehicleId: 'veh_sav1',
      date: TODAY,
      departHHMM: '13:00',
      durationMin: 240,
      farePerSeat: 26000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.value;
    expect(t.status).toBe('scheduled');
    expect(t.capacity).toBe(33); // veh_sav1 seats
    expect(t.direction).toBe('KLA_MBR');
    expect(new Date(t.destinationArrival).getTime()).toBeGreaterThan(new Date(t.originDeparture).getTime());
    // Stops come from the route's ordered hub sequence.
    expect(t.stops.map((s) => s.hubId)).toEqual(['hub_kla_nakawa', 'hub_kla_ndeeba', 'hub_kla_natete']);
    expect(getTrip(r.state, t.id)).toBeDefined();
  });

  it('rejects a vehicle that belongs to a different operator', () => {
    const r = createTrip(state, {
      operatorId: 'op_savannah',
      routeId: 'route_kla_mbr',
      vehicleId: 'veh_pearl1', // Pearl's vehicle
      date: TODAY,
      departHHMM: '13:00',
      durationMin: 240,
      farePerSeat: 26000,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects a non-positive journey duration (arrival must be after departure)', () => {
    const r = createTrip(state, {
      operatorId: 'op_savannah',
      routeId: 'route_kla_mbr',
      vehicleId: 'veh_sav1',
      date: TODAY,
      departHHMM: '13:00',
      durationMin: 0,
      farePerSeat: 26000,
    });
    expect(r.ok).toBe(false);
  });

  it('assigns crew as part of creation', () => {
    const r = createTrip(state, {
      operatorId: 'op_pearl',
      routeId: 'route_kla_mbr',
      vehicleId: 'veh_pearl1',
      date: TODAY,
      departHHMM: '20:00', // late, no seed overlap for pearl crew
      durationMin: 240,
      farePerSeat: 30000,
      driverId: 'staff_drv_pearl',
      conductorId: 'staff_con_pearl',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(staffForTrip(r.state, r.value.id, 'driver')?.id).toBe('staff_drv_pearl');
    expect(staffForTrip(r.state, r.value.id, 'conductor')?.id).toBe('staff_con_pearl');
  });
});

describe('dispatcher: assignStaff', () => {
  let state: AppState;
  beforeEach(() => {
    state = fresh();
  });

  function newPearlTrip(s: AppState, time: string) {
    const r = createTrip(s, {
      operatorId: 'op_pearl',
      routeId: 'route_kla_mbr',
      vehicleId: 'veh_pearl1',
      date: TODAY,
      departHHMM: time,
      durationMin: 240,
      farePerSeat: 30000,
    });
    if (!r.ok) throw new Error(r.error);
    return r;
  }

  it('assigns and then clears a conductor', () => {
    const created = newPearlTrip(state, '20:00');
    const a = assignStaff(created.state, created.value.id, 'conductor', 'staff_con_pearl');
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(staffForTrip(a.state, created.value.id, 'conductor')?.id).toBe('staff_con_pearl');
    const cleared = assignStaff(a.state, created.value.id, 'conductor', null);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(staffForTrip(cleared.state, created.value.id, 'conductor')).toBeUndefined();
  });

  it('rejects a driver from another operator', () => {
    const created = newPearlTrip(state, '20:00');
    const a = assignStaff(created.state, created.value.id, 'driver', 'staff_drv_sav');
    expect(a.ok).toBe(false);
  });

  it('rejects assigning to the wrong role slot', () => {
    const created = newPearlTrip(state, '20:00');
    // staff_con_pearl is a conductor; cannot be a driver.
    const a = assignStaff(created.state, created.value.id, 'driver', 'staff_con_pearl');
    expect(a.ok).toBe(false);
  });

  it('rejects a crew member already on an overlapping trip', () => {
    // Two Pearl departures that overlap in time.
    const first = newPearlTrip(state, '20:00');
    const a1 = assignStaff(first.state, first.value.id, 'driver', 'staff_drv_pearl');
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    const second = newPearlTrip(a1.state, '21:00'); // 21:00–01:00 overlaps 20:00–00:00
    const a2 = assignStaff(second.state, second.value.id, 'driver', 'staff_drv_pearl');
    expect(a2.ok).toBe(false);
  });

  it('allows a crew member on a non-overlapping later trip', () => {
    const first = newPearlTrip(state, '05:00'); // 05:00–09:00
    const a1 = assignStaff(first.state, first.value.id, 'driver', 'staff_drv_pearl');
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    const second = newPearlTrip(a1.state, '18:00'); // 18:00–22:00, no overlap
    const a2 = assignStaff(second.state, second.value.id, 'driver', 'staff_drv_pearl');
    expect(a2.ok).toBe(true);
  });
});

describe('fare snapshot is preserved across operator edits', () => {
  it('keeps the booked fare when the operator later changes the trip fare', () => {
    let state = fresh();
    const trip = state.trips.find((t) => t.direction === 'KLA_MBR' && t.date === TODAY)!;
    const originalFare = trip.farePerSeat;

    const r = reserve(state, {
      tripId: trip.id,
      pickupHubId: trip.stops[0].hubId,
      passengerName: 'Amina',
      seats: 2,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fareAtBooking).toBe(originalFare);
    state = r.state;
    const bookingId = r.value.id;

    const edited = editTrip(state, trip.id, { farePerSeat: originalFare + 10000 });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const booking = edited.state.bookings.find((b) => b.id === bookingId)!;
    expect(booking.fareAtBooking).toBe(originalFare); // unchanged
    expect(getTrip(edited.state, trip.id)!.farePerSeat).toBe(originalFare + 10000);
  });
});
