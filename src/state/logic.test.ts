import { describe, it, expect, beforeEach } from 'vitest';
import type { AppState } from '../types';
import { buildSeedState } from '../data/seed';
import {
  reserve,
  cancelBooking,
  checkIn,
  checkInByReference,
  boardBooking,
  boardByCode,
  startTrip,
  reportDelay,
  completeTrip,
  cancelTrip,
  recordUnresolvedPickup,
  editTrip,
  availableSeats,
  seatsReserved,
  waitingSeatsAtHub,
  getTrip,
} from './logic';

const TODAY = '2026-09-10';

function fresh(): AppState {
  return buildSeedState(TODAY);
}

// Pick a Kampala->Mbarara trip today and its first hub.
function pickTrip(state: AppState) {
  const trip = state.trips.find((t) => t.direction === 'KLA_MBR' && t.date === TODAY)!;
  const hubId = trip.stops[0].hubId;
  return { trip, hubId };
}

describe('reservation & capacity', () => {
  let state: AppState;
  beforeEach(() => {
    state = fresh();
  });

  it('reserves seats and decreases availability by the seat count', () => {
    const { trip, hubId } = pickTrip(state);
    const before = availableSeats(state, trip);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = availableSeats(r.state, getTrip(r.state, trip.id)!);
    expect(after).toBe(before - 2);
    expect(seatsReserved(r.state, trip.id)).toBe(2);
    expect(r.value.reference).toMatch(/^TG-/);
    expect(r.value.boardingCode).toMatch(/^\d{4}$/);
  });

  it('prevents overbooking beyond capacity', () => {
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, {
      tripId: trip.id,
      pickupHubId: hubId,
      passengerName: 'Big Group',
      seats: trip.capacity + 1,
    });
    expect(r.ok).toBe(false);
  });

  it('fills exactly to capacity then rejects the next seat', () => {
    const { trip, hubId } = pickTrip(state);
    let s = state;
    const full = reserve(s, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Full', seats: trip.capacity });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    s = full.state;
    expect(availableSeats(s, getTrip(s, trip.id)!)).toBe(0);
    const over = reserve(s, { tripId: trip.id, pickupHubId: hubId, passengerName: 'One more', seats: 1 });
    expect(over.ok).toBe(false);
  });

  it('cancelling a reservation restores capacity', () => {
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    if (!r.ok) return;
    const before = availableSeats(state, trip);
    const c = cancelBooking(r.state, r.value.id);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(availableSeats(c.state, getTrip(c.state, trip.id)!)).toBe(before);
    expect(seatsReserved(c.state, trip.id)).toBe(0);
  });

  it('treats a rapid duplicate reservation as the same booking (no double count)', () => {
    const { trip, hubId } = pickTrip(state);
    const first = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    if (!first.ok) return;
    const dup = reserve(first.state, {
      tripId: trip.id,
      pickupHubId: hubId,
      passengerName: 'Amina',
      seats: 2,
    });
    expect(dup.ok).toBe(true);
    if (!dup.ok) return;
    expect(dup.value.id).toBe(first.value.id);
    expect(seatsReserved(dup.state, trip.id)).toBe(2);
  });
});

describe('full coordinated pickup scenario', () => {
  it('reserve 2 → check in → waiting to staff → board by code → complete', () => {
    let state = fresh();
    const { trip, hubId } = pickTrip(state);

    // 1-2. Reserve two seats, capacity decreases by two.
    const before = availableSeats(state, trip);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;
    expect(availableSeats(state, getTrip(state, trip.id)!)).toBe(before - 2);
    const booking = r.value;

    // 3. Check in as the passenger.
    const ci = checkIn(state, booking.id);
    expect(ci.ok).toBe(true);
    if (!ci.ok) return;
    state = ci.state;

    // 4. Both passengers appear as waiting to attendant & conductor (seat count = 2).
    expect(waitingSeatsAtHub(state, trip.id, hubId)).toBe(2);

    // 5. Validate the boarding code and confirm boarding.
    const board = boardByCode(state, trip.id, booking.boardingCode);
    expect(board.ok).toBe(true);
    if (!board.ok) return;
    state = board.state;

    // 6. Booking updates to boarded.
    expect(state.bookings.find((b) => b.id === booking.id)!.status).toBe('boarded');
    // No longer counted as waiting.
    expect(waitingSeatsAtHub(state, trip.id, hubId)).toBe(0);

    // 7. Complete the trip.
    const done = completeTrip(state, trip.id);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    state = done.state;

    // 8. Booking now completed; trip completed.
    expect(state.bookings.find((b) => b.id === booking.id)!.status).toBe('completed');
    expect(getTrip(state, trip.id)!.status).toBe('completed');
  });
});

describe('boarding validation', () => {
  let state: AppState;
  beforeEach(() => {
    state = fresh();
  });

  it('rejects an unknown boarding code', () => {
    const { trip } = pickTrip(state);
    const r = boardByCode(state, trip.id, '0000');
    expect(r.ok).toBe(false);
  });

  it('rejects a code that belongs to another trip', () => {
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 1 });
    if (!r.ok) return;
    const otherTrip = state.trips.find((t) => t.id !== trip.id && t.direction === 'KLA_MBR')!;
    const attempt = boardByCode(r.state, otherTrip.id, r.value.boardingCode);
    expect(attempt.ok).toBe(false);
  });

  it('rejects a cancelled booking code', () => {
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 1 });
    if (!r.ok) return;
    const c = cancelBooking(r.state, r.value.id);
    if (!c.ok) return;
    const attempt = boardByCode(c.state, trip.id, r.value.boardingCode);
    expect(attempt.ok).toBe(false);
  });

  it('does not board the same booking twice (no double count)', () => {
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 1 });
    if (!r.ok) return;
    const first = boardBooking(r.state, r.value.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = boardBooking(first.state, r.value.id);
    expect(second.ok).toBe(false); // already boarded
    expect(first.state.bookings.filter((b) => b.status === 'boarded').length).toBe(1);
  });
});

describe('check-in guards', () => {
  it('cannot check in a cancelled booking', () => {
    let state = fresh();
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 1 });
    if (!r.ok) return;
    const c = cancelBooking(r.state, r.value.id);
    if (!c.ok) return;
    state = c.state;
    const ci = checkIn(state, r.value.id);
    expect(ci.ok).toBe(false);
  });

  it('cannot check in for a cancelled trip', () => {
    const state = fresh();
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 1 });
    if (!r.ok) return;
    const cancelled = cancelTrip(r.state, trip.id, 'maintenance');
    if (!cancelled.ok) return;
    // booking auto-cancelled; check-in should fail.
    const ci = checkIn(cancelled.state, r.value.id);
    expect(ci.ok).toBe(false);
  });

  it('check-in by reference is idempotent (no double state change)', () => {
    let state = fresh();
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    if (!r.ok) return;
    state = r.state;
    const a = checkInByReference(state, r.value.reference);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = checkInByReference(a.state, r.value.reference);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(waitingSeatsAtHub(b.state, trip.id, hubId)).toBe(2);
  });
});

describe('trip management', () => {
  it('capacity cannot drop below active reservations', () => {
    let state = fresh();
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Group', seats: 5 });
    if (!r.ok) return;
    state = r.state;
    const bad = editTrip(state, trip.id, { capacity: 3 });
    expect(bad.ok).toBe(false);
    const okEdit = editTrip(state, trip.id, { capacity: 10 });
    expect(okEdit.ok).toBe(true);
  });

  it('delay is tracked separately and applies while en route', () => {
    let state = fresh();
    const { trip } = pickTrip(state);
    const started = startTrip(state, trip.id);
    if (!started.ok) return;
    state = started.state;
    expect(getTrip(state, trip.id)!.status).toBe('en_route');
    const d = reportDelay(state, trip.id, 20);
    if (!d.ok) return;
    expect(getTrip(d.state, trip.id)!.delayMinutes).toBe(20);
    expect(getTrip(d.state, trip.id)!.status).toBe('en_route');
  });

  it('cancelling a trip cancels affected active bookings', () => {
    let state = fresh();
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    if (!r.ok) return;
    state = r.state;
    const cancelled = cancelTrip(state, trip.id, 'vehicle issue');
    if (!cancelled.ok) return;
    expect(cancelled.state.bookings.find((b) => b.id === r.value.id)!.status).toBe('cancelled');
    expect(seatsReserved(cancelled.state, trip.id)).toBe(0);
  });

  it('records an unresolved pickup for checked-in-but-unboarded passengers', () => {
    const state = fresh();
    const { trip, hubId } = pickTrip(state);
    const r = reserve(state, { tripId: trip.id, pickupHubId: hubId, passengerName: 'Amina', seats: 2 });
    if (!r.ok) return;
    const ci = checkIn(r.state, r.value.id);
    if (!ci.ok) return;
    const rec = recordUnresolvedPickup(ci.state, trip.id, hubId, 'not present');
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.value).toBe(2);
    expect(rec.state.bookings.find((b) => b.id === r.value.id)!.unresolved).toBe(true);
  });
});
