import type {
  ActivityEvent,
  ActivityKind,
  AppState,
  Booking,
  StaffMember,
  StaffRole,
  Trip,
} from '../types';
import { makeBookingRef, makeBoardingCode, uid } from '../lib/id';
import { shiftMinutes, minutesBetween, kampalaDateTime, formatTime } from '../lib/time';
import { buildStops } from '../data/seed';

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------
export type Result<T> = { ok: true; state: AppState; value: T } | { ok: false; error: string };

function ok<T>(state: AppState, value: T): Result<T> {
  return { ok: true, state, value };
}
function fail<T>(error: string): Result<T> {
  return { ok: false, error };
}

const ACTIVE_BOOKING_STATUSES: Booking['status'][] = ['reserved', 'checked_in', 'boarded'];

// ---------------------------------------------------------------------------
// Selectors (pure, no mutation)
// ---------------------------------------------------------------------------
export function getTrip(state: AppState, tripId: string): Trip | undefined {
  return state.trips.find((t) => t.id === tripId);
}

export function activeBookingsForTrip(state: AppState, tripId: string): Booking[] {
  return state.bookings.filter(
    (b) => b.tripId === tripId && ACTIVE_BOOKING_STATUSES.includes(b.status),
  );
}

/** Total seats currently held by active bookings on a trip. */
export function seatsReserved(state: AppState, tripId: string): number {
  return activeBookingsForTrip(state, tripId).reduce((sum, b) => sum + b.seats, 0);
}

/** Seats still available for sale on a trip. */
export function availableSeats(state: AppState, trip: Trip): number {
  return Math.max(0, trip.capacity - seatsReserved(state, trip.id));
}

/** Passengers (seat count) that have checked in at a hub for a trip. */
export function waitingSeatsAtHub(state: AppState, tripId: string, hubId: string): number {
  return state.bookings
    .filter(
      (b) => b.tripId === tripId && b.pickupHubId === hubId && b.status === 'checked_in',
    )
    .reduce((sum, b) => sum + b.seats, 0);
}

/** Effective (delay-adjusted) pickup time for a hub on a trip. */
export function effectivePickupTime(trip: Trip, hubId: string): string | undefined {
  const stop = trip.stops.find((s) => s.hubId === hubId);
  if (!stop) return undefined;
  return shiftMinutes(stop.pickupTime, trip.delayMinutes);
}

export function effectiveArrival(trip: Trip): string {
  return shiftMinutes(trip.destinationArrival, trip.delayMinutes);
}

export function isTripActionable(trip: Trip): boolean {
  return trip.status !== 'completed' && trip.status !== 'cancelled';
}

// ---------------------------------------------------------------------------
// Activity log helper
// ---------------------------------------------------------------------------
function logEvent(
  state: AppState,
  kind: ActivityKind,
  message: string,
  extra: Partial<Pick<ActivityEvent, 'tripId' | 'bookingId' | 'hubId'>> = {},
): AppState {
  const event: ActivityEvent = {
    id: uid('act'),
    kind,
    message,
    at: new Date().toISOString(),
    ...extra,
  };
  return { ...state, activity: [event, ...state.activity].slice(0, 200) };
}

// ---------------------------------------------------------------------------
// Booking actions
// ---------------------------------------------------------------------------
export interface ReserveInput {
  tripId: string;
  pickupHubId: string;
  passengerName: string;
  phone?: string;
  seats: number;
}

export function reserve(state: AppState, input: ReserveInput): Result<Booking> {
  const trip = getTrip(state, input.tripId);
  if (!trip) return fail('That trip could not be found.');
  if (trip.status === 'cancelled') return fail('This trip has been cancelled.');
  if (trip.status === 'completed') return fail('This trip has already been completed.');
  if (!trip.stops.some((s) => s.hubId === input.pickupHubId)) {
    return fail('That pickup hub is not served by this trip.');
  }
  const name = input.passengerName.trim();
  if (!name) return fail('Please enter a passenger name.');
  if (input.seats < 1) return fail('At least one passenger is required.');

  const available = availableSeats(state, trip);
  if (input.seats > available) {
    return fail(
      available === 0
        ? 'This trip is fully booked.'
        : `Only ${available} seat${available === 1 ? '' : 's'} left on this trip.`,
    );
  }

  // Duplicate-click guard: reject an identical active booking created moments ago.
  const now = Date.now();
  const dup = state.bookings.find(
    (b) =>
      b.tripId === input.tripId &&
      b.pickupHubId === input.pickupHubId &&
      b.passengerName.trim().toLowerCase() === name.toLowerCase() &&
      b.seats === input.seats &&
      ACTIVE_BOOKING_STATUSES.includes(b.status) &&
      now - new Date(b.createdAt).getTime() < 8000,
  );
  if (dup) {
    // Treat as the same reservation rather than creating a second one.
    return ok(state, dup);
  }

  const refs = new Set(state.bookings.map((b) => b.reference));
  const codes = new Set(state.bookings.map((b) => b.boardingCode));
  const booking: Booking = {
    id: uid('bk'),
    reference: makeBookingRef(refs),
    boardingCode: makeBoardingCode(codes),
    tripId: input.tripId,
    pickupHubId: input.pickupHubId,
    passengerName: name,
    phone: input.phone?.trim() || undefined,
    seats: input.seats,
    fareAtBooking: trip.farePerSeat,
    status: 'reserved',
    createdAt: new Date().toISOString(),
  };

  let next: AppState = { ...state, bookings: [booking, ...state.bookings] };
  next = logEvent(
    next,
    'reservation',
    `${name} reserved ${booking.seats} seat${booking.seats === 1 ? '' : 's'} (${booking.reference}).`,
    { tripId: trip.id, bookingId: booking.id, hubId: input.pickupHubId },
  );
  return ok(next, booking);
}

export function cancelBooking(state: AppState, bookingId: string): Result<Booking> {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return fail('Booking not found.');
  if (booking.status === 'cancelled') return ok(state, booking); // idempotent
  if (booking.status === 'boarded' || booking.status === 'completed') {
    return fail('You cannot cancel after boarding.');
  }
  const updated: Booking = {
    ...booking,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  };
  let next: AppState = {
    ...state,
    bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
  };
  next = logEvent(
    next,
    'cancellation',
    `${booking.passengerName} cancelled ${booking.seats} seat${booking.seats === 1 ? '' : 's'} (${booking.reference}). Seats returned.`,
    { tripId: booking.tripId, bookingId: booking.id, hubId: booking.pickupHubId },
  );
  return ok(next, updated);
}

export function checkIn(state: AppState, bookingId: string): Result<Booking> {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return fail('Booking not found.');
  if (booking.status === 'cancelled') return fail('This booking was cancelled.');
  if (booking.status === 'boarded') return fail('This booking is already boarded.');
  if (booking.status === 'completed') return fail('This trip is already completed.');
  if (booking.status === 'checked_in') return ok(state, booking); // idempotent

  const trip = getTrip(state, booking.tripId);
  if (!trip) return fail('Trip not found.');
  if (trip.status === 'cancelled') return fail('This trip has been cancelled.');
  if (trip.status === 'completed') return fail('This trip is already completed.');

  const updated: Booking = {
    ...booking,
    status: 'checked_in',
    checkedInAt: new Date().toISOString(),
  };
  let next: AppState = {
    ...state,
    bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
  };
  next = logEvent(
    next,
    'check_in',
    `${booking.passengerName} checked in at the hub (${booking.reference}).`,
    { tripId: booking.tripId, bookingId: booking.id, hubId: booking.pickupHubId },
  );
  return ok(next, updated);
}

export function checkInByReference(state: AppState, reference: string): Result<Booking> {
  const ref = reference.trim().toUpperCase();
  const booking = state.bookings.find((b) => b.reference.toUpperCase() === ref);
  if (!booking) return fail(`No booking found for reference "${reference}".`);
  return checkIn(state, booking.id);
}

/** Board a booking (idempotent — will not double-board). */
export function boardBooking(state: AppState, bookingId: string): Result<Booking> {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return fail('Booking not found.');
  if (booking.status === 'cancelled') return fail('This booking was cancelled.');
  if (booking.status === 'boarded' || booking.status === 'completed') {
    return fail('This passenger is already boarded.');
  }
  const trip = getTrip(state, booking.tripId);
  if (!trip) return fail('Trip not found.');
  if (trip.status === 'cancelled') return fail('This trip has been cancelled.');
  if (trip.status === 'completed') return fail('This trip is already completed.');

  const updated: Booking = {
    ...booking,
    status: 'boarded',
    boardedAt: new Date().toISOString(),
  };
  let next: AppState = {
    ...state,
    bookings: state.bookings.map((b) => (b.id === bookingId ? updated : b)),
  };
  next = logEvent(
    next,
    'boarding',
    `${booking.passengerName} boarded (${booking.reference}, ${booking.seats} seat${booking.seats === 1 ? '' : 's'}).`,
    { tripId: booking.tripId, bookingId: booking.id, hubId: booking.pickupHubId },
  );
  return ok(next, updated);
}

/** Validate a boarding code against a specific trip. */
export function boardByCode(state: AppState, tripId: string, code: string): Result<Booking> {
  const clean = code.trim();
  if (!clean) return fail('Enter a boarding code.');
  const match = state.bookings.find((b) => b.boardingCode === clean);
  if (!match) return fail(`Code ${clean} is not recognised.`);
  if (match.tripId !== tripId) {
    return fail(`Code ${clean} belongs to a different trip.`);
  }
  if (match.status === 'cancelled') return fail(`Code ${clean} belongs to a cancelled booking.`);
  if (match.status === 'boarded' || match.status === 'completed') {
    return fail(`${match.passengerName} is already boarded.`);
  }
  return boardBooking(state, match.id);
}

// ---------------------------------------------------------------------------
// Trip actions
// ---------------------------------------------------------------------------
export function startTrip(state: AppState, tripId: string): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (!isTripActionable(trip)) return fail('This trip can no longer be started.');
  const updated: Trip = {
    ...trip,
    status: 'en_route',
    stops: trip.stops.map((s, i) => (i === 0 ? { ...s, reached: true } : s)),
    lastUpdate: new Date().toISOString(),
  };
  let next = { ...state, trips: state.trips.map((t) => (t.id === tripId ? updated : t)) };
  next = logEvent(next, 'trip_start', `Trip departed from origin.`, { tripId });
  return ok(next, updated);
}

export function setBoarding(state: AppState, tripId: string): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (!isTripActionable(trip)) return fail('This trip can no longer be updated.');
  const updated: Trip = { ...trip, status: 'boarding', lastUpdate: new Date().toISOString() };
  const next = { ...state, trips: state.trips.map((t) => (t.id === tripId ? updated : t)) };
  return ok(next, updated);
}

export function reportDelay(state: AppState, tripId: string, minutes: number): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (!isTripActionable(trip)) return fail('This trip can no longer be delayed.');
  const delay = Math.max(0, trip.delayMinutes + minutes);
  const updated: Trip = { ...trip, delayMinutes: delay, lastUpdate: new Date().toISOString() };
  let next = { ...state, trips: state.trips.map((t) => (t.id === tripId ? updated : t)) };
  next = logEvent(next, 'delay', `Delay updated to ${delay} min.`, { tripId });
  return ok(next, updated);
}

/** Advance the bus to the next un-reached hub stop. */
export function reachHub(state: AppState, tripId: string, hubId: string): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (!isTripActionable(trip)) return fail('This trip can no longer be updated.');
  const stop = trip.stops.find((s) => s.hubId === hubId);
  if (!stop) return fail('That hub is not on this trip.');
  const updated: Trip = {
    ...trip,
    status: trip.status === 'scheduled' ? 'en_route' : trip.status,
    stops: trip.stops.map((s) => (s.hubId === hubId ? { ...s, reached: true } : s)),
    lastUpdate: new Date().toISOString(),
  };
  let next = { ...state, trips: state.trips.map((t) => (t.id === tripId ? updated : t)) };
  next = logEvent(next, 'reach_hub', `Bus reached a pickup hub.`, { tripId, hubId });
  return ok(next, updated);
}

export function completeTrip(state: AppState, tripId: string): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (trip.status === 'cancelled') return fail('A cancelled trip cannot be completed.');
  if (trip.status === 'completed') return ok(state, trip);
  const updated: Trip = {
    ...trip,
    status: 'completed',
    progress: 1,
    stops: trip.stops.map((s) => ({ ...s, reached: true })),
    lastUpdate: new Date().toISOString(),
  };
  // Classify each active booking's outcome at completion:
  //  boarded    -> completed (travelled)
  //  checked_in -> missed_pickup (unboarded despite checking in; needs follow-up)
  //  reserved   -> not_boarded (never checked in; neutral, no fault)
  const now = new Date().toISOString();
  const bookings = state.bookings.map((b) => {
    if (b.tripId !== tripId) return b;
    if (b.status === 'boarded') return { ...b, status: 'completed' as const, boardedAt: b.boardedAt ?? now };
    if (b.status === 'checked_in') return { ...b, status: 'missed_pickup' as const, unresolved: true };
    if (b.status === 'reserved') return { ...b, status: 'not_boarded' as const };
    return b;
  });
  let next = {
    ...state,
    trips: state.trips.map((t) => (t.id === tripId ? updated : t)),
    bookings,
  };
  next = logEvent(next, 'trip_completed', `Trip completed.`, { tripId });
  const missed = state.bookings.filter((b) => b.tripId === tripId && b.status === 'checked_in');
  if (missed.length > 0) {
    const seats = missed.reduce((s, b) => s + b.seats, 0);
    next = logEvent(next, 'unresolved_pickup', `${seats} checked-in passenger seat(s) not boarded at completion.`, { tripId });
  }
  return ok(next, updated);
}

export function cancelTrip(state: AppState, tripId: string, reason: string): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (trip.status === 'completed') return fail('A completed trip cannot be cancelled.');
  const cleanReason = reason.trim() || 'No reason provided';
  const updated: Trip = {
    ...trip,
    status: 'cancelled',
    cancelReason: cleanReason,
    lastUpdate: new Date().toISOString(),
  };
  // Cancel affected active bookings.
  const bookings = state.bookings.map((b) =>
    b.tripId === tripId && ACTIVE_BOOKING_STATUSES.includes(b.status)
      ? { ...b, status: 'cancelled' as const, cancelledAt: new Date().toISOString() }
      : b,
  );
  let next = {
    ...state,
    trips: state.trips.map((t) => (t.id === tripId ? updated : t)),
    bookings,
  };
  next = logEvent(next, 'trip_cancelled', `Trip cancelled: ${cleanReason}.`, { tripId });
  return ok(next, updated);
}

/** Record an unresolved pickup when leaving a hub with checked-in passengers unboarded. */
export function recordUnresolvedPickup(
  state: AppState,
  tripId: string,
  hubId: string,
  reason: string,
): Result<number> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  const affected = state.bookings.filter(
    (b) => b.tripId === tripId && b.pickupHubId === hubId && b.status === 'checked_in',
  );
  const cleanReason = reason.trim() || 'No reason provided';
  const bookings = state.bookings.map((b) =>
    affected.some((a) => a.id === b.id) ? { ...b, unresolved: true } : b,
  );
  let next = { ...state, bookings };
  const seats = affected.reduce((sum, b) => sum + b.seats, 0);
  next = logEvent(
    next,
    'unresolved_pickup',
    `Left hub with ${seats} checked-in passenger${seats === 1 ? '' : 's'} unboarded: ${cleanReason}.`,
    { tripId, hubId },
  );
  return ok(next, seats);
}

// ---------------------------------------------------------------------------
// Operator schedule edit
// ---------------------------------------------------------------------------
export interface TripEditInput {
  originDeparture?: string;
  farePerSeat?: number;
  capacity?: number;
  status?: Trip['status'];
}

export function editTrip(state: AppState, tripId: string, edit: TripEditInput): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');

  if (edit.capacity !== undefined) {
    const active = seatsReserved(state, tripId);
    if (edit.capacity < active) {
      return fail(`Capacity cannot be below ${active} active reserved seat${active === 1 ? '' : 's'}.`);
    }
    if (edit.capacity < 1) return fail('Capacity must be at least 1.');
  }
  if (edit.farePerSeat !== undefined && edit.farePerSeat < 0) {
    return fail('Fare cannot be negative.');
  }

  let stops = trip.stops;
  let destinationArrival = trip.destinationArrival;
  if (edit.originDeparture && edit.originDeparture !== trip.originDeparture) {
    const shift = minutesBetween(trip.originDeparture, edit.originDeparture);
    stops = trip.stops.map((s) => ({ ...s, pickupTime: shiftMinutes(s.pickupTime, shift) }));
    destinationArrival = shiftMinutes(trip.destinationArrival, shift);
  }

  const updated: Trip = {
    ...trip,
    originDeparture: edit.originDeparture ?? trip.originDeparture,
    destinationArrival,
    farePerSeat: edit.farePerSeat ?? trip.farePerSeat,
    capacity: edit.capacity ?? trip.capacity,
    status: edit.status ?? trip.status,
    stops,
    lastUpdate: new Date().toISOString(),
  };
  let next = { ...state, trips: state.trips.map((t) => (t.id === tripId ? updated : t)) };
  next = logEvent(next, 'schedule_edit', `Departure schedule updated.`, { tripId });
  return ok(next, updated);
}

// ---------------------------------------------------------------------------
// Dispatcher: create departures & assign crew
// ---------------------------------------------------------------------------

/** The staff member of a given role currently assigned to a trip, if any. */
export function staffForTrip(
  state: AppState,
  tripId: string,
  role: StaffRole,
): StaffMember | undefined {
  return (state.staff ?? []).find((s) => s.role === role && s.assignedTripIds.includes(tripId));
}

/** Scheduled time window [departure, arrival] of a trip, delay-independent. */
function tripWindow(trip: Trip): [number, number] {
  return [new Date(trip.originDeparture).getTime(), new Date(trip.destinationArrival).getTime()];
}

/** Two trips overlap if their scheduled windows intersect (a person cannot crew both). */
function windowsOverlap(a: Trip, b: Trip): boolean {
  const [as, ae] = tripWindow(a);
  const [bs, be] = tripWindow(b);
  return as < be && bs < ae;
}

/** A trip another assignment would clash with, for a staff member being put on `trip`. */
function conflictingTrip(state: AppState, staff: StaffMember, trip: Trip): Trip | undefined {
  for (const otherId of staff.assignedTripIds) {
    if (otherId === trip.id) continue;
    const other = getTrip(state, otherId);
    if (!other) continue;
    if (other.status === 'cancelled') continue;
    if (windowsOverlap(trip, other)) return other;
  }
  return undefined;
}

export interface CreateTripInput {
  routeId: string;
  operatorId: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD (Kampala)
  departHHMM: string; // "07:00"
  durationMin: number;
  farePerSeat: number;
  driverId?: string | null;
  conductorId?: string | null;
}

export function createTrip(state: AppState, input: CreateTripInput): Result<Trip> {
  const route = state.routes.find((r) => r.id === input.routeId);
  if (!route) return fail('Choose a valid route.');
  const operator = state.operators.find((o) => o.id === input.operatorId);
  if (!operator) return fail('Choose a valid operator.');
  const vehicle = state.vehicles.find((v) => v.id === input.vehicleId);
  if (!vehicle) return fail('Choose a vehicle.');
  if (vehicle.operatorId !== input.operatorId) {
    return fail('That vehicle belongs to a different operator.');
  }
  if (!input.date) return fail('Choose a departure date.');
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.departHHMM.trim());
  if (!m) return fail('Enter a departure time as HH:MM.');
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return fail('Enter a valid departure time.');
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) {
    return fail('Journey duration must be greater than zero so arrival is after departure.');
  }
  if (!Number.isFinite(input.farePerSeat) || input.farePerSeat < 0) {
    return fail('Fare cannot be negative.');
  }
  if (vehicle.seats < 1) return fail('Vehicle capacity must be at least 1.');

  const originDeparture = new Date(kampalaDateTime(input.date, hh, mm)).toISOString();
  const destinationArrival = shiftMinutes(originDeparture, input.durationMin);
  const trip: Trip = {
    id: uid('trip'),
    routeId: route.id,
    operatorId: operator.id,
    vehicleId: vehicle.id,
    direction: route.direction,
    date: input.date,
    originDeparture,
    destinationArrival,
    farePerSeat: Math.round(input.farePerSeat),
    capacity: vehicle.seats,
    status: 'scheduled',
    delayMinutes: 0,
    stops: buildStops(route.id, originDeparture),
    progress: 0,
    lastUpdate: new Date().toISOString(),
  };

  let next: AppState = { ...state, trips: [...state.trips, trip] };
  next = logEvent(
    next,
    'trip_created',
    `New ${route.direction === 'KLA_MBR' ? 'Kampala → Mbarara' : 'Mbarara → Kampala'} departure created for ${operator.name}.`,
    { tripId: trip.id },
  );

  // Optional crew assignment as part of creation; a clash aborts the whole create.
  if (input.driverId) {
    const r = assignStaff(next, trip.id, 'driver', input.driverId);
    if (!r.ok) return r as Result<Trip>;
    next = r.state;
  }
  if (input.conductorId) {
    const r = assignStaff(next, trip.id, 'conductor', input.conductorId);
    if (!r.ok) return r as Result<Trip>;
    next = r.state;
  }
  return ok(next, trip);
}

/** Assign (or, with staffId null, clear) the driver or conductor of a trip. */
export function assignStaff(
  state: AppState,
  tripId: string,
  role: Extract<StaffRole, 'driver' | 'conductor'>,
  staffId: string | null,
): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (trip.status === 'completed' || trip.status === 'cancelled') {
    return fail('This trip can no longer be re-crewed.');
  }
  const roster = state.staff ?? [];

  // Clear the current holder of this role on this trip.
  const cleared = roster.map((s) =>
    s.role === role && s.assignedTripIds.includes(tripId)
      ? { ...s, assignedTripIds: s.assignedTripIds.filter((id) => id !== tripId) }
      : s,
  );

  if (!staffId) {
    let next: AppState = { ...state, staff: cleared };
    next = logEvent(next, 'assignment', `${role === 'driver' ? 'Driver' : 'Conductor'} unassigned.`, { tripId });
    return ok(next, trip);
  }

  const member = cleared.find((s) => s.id === staffId);
  if (!member) return fail('That staff member could not be found.');
  if (member.role !== role) return fail(`${member.name} is not a ${role}.`);
  if (member.operatorId && member.operatorId !== trip.operatorId) {
    return fail(`${member.name} is not on this operator’s crew.`);
  }
  const clash = conflictingTrip({ ...state, staff: cleared }, member, trip);
  if (clash) {
    return fail(
      `${member.name} is already crewing an overlapping trip departing ${formatTime(clash.originDeparture)}.`,
    );
  }

  const staff = cleared.map((s) =>
    s.id === staffId ? { ...s, assignedTripIds: [...s.assignedTripIds, tripId] } : s,
  );
  let next: AppState = { ...state, staff };
  next = logEvent(
    next,
    'assignment',
    `${member.name} assigned as ${role} for a departure.`,
    { tripId },
  );
  return ok(next, trip);
}

// ---------------------------------------------------------------------------
// Tracking simulation
// ---------------------------------------------------------------------------
/** Advance the simulated bus a step along the route; sets status/progress coherently. */
export function advanceBus(state: AppState, tripId: string, step = 0.15): Result<Trip> {
  const trip = getTrip(state, tripId);
  if (!trip) return fail('Trip not found.');
  if (trip.status === 'cancelled') return fail('This trip is cancelled.');
  if (trip.status === 'completed') return ok(state, trip);

  const progress = Math.min(1, +(trip.progress + step).toFixed(3));
  let status = trip.status;
  if (status === 'scheduled' || status === 'boarding') status = 'en_route';

  // Mark stops reached as the bus passes their fraction of the route.
  const stopCount = trip.stops.length;
  const stops = trip.stops.map((s, i) => {
    const stopFraction = stopCount > 1 ? i / (stopCount * 2) : 0; // hubs cluster near origin
    return progress >= stopFraction ? { ...s, reached: true } : s;
  });

  const updated: Trip = {
    ...trip,
    progress,
    status,
    stops,
    lastUpdate: new Date().toISOString(),
  };
  let next = { ...state, trips: state.trips.map((t) => (t.id === tripId ? updated : t)) };
  if (progress >= 1) {
    const done = completeTrip(next, tripId);
    if (done.ok) next = done.state;
  }
  return ok(next, updated);
}
