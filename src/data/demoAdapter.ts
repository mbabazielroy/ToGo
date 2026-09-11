// Demo implementation of the DataAdapter, backed by the existing local state and
// the pure business rules in src/state/logic.ts. This keeps the demo mode's rules
// identical to what the passenger/staff prototype already enforces, and gives the
// connected code a drop-in offline implementation of the same interface.

import type { AppState } from '../types';
import { buildSeedState } from '../data/seed';
import { kampalaToday, shiftMinutes } from '../lib/time';
import * as logic from '../state/logic';
import { operatorById } from '../lib/lookup';
import {
  AdapterError,
  type BookingView,
  type DataAdapter,
  type HubExpectedRow,
  type HubView,
  type LocationView,
  type ManifestRow,
  type NotificationView,
  type ReserveInput,
  type StaffView,
  type Subscription,
  type TripSearch,
  type TripStatusCode,
  type TripStopView,
  type TripView,
} from './adapter';

const NOOP: Subscription = { unsubscribe: () => {} };

function stopId(tripId: string, hubId: string): string {
  return `${tripId}::${hubId}`;
}
function parseStop(id: string): { tripId: string; hubId: string } {
  const [tripId, hubId] = id.split('::');
  return { tripId, hubId };
}

export class DemoAdapter implements DataAdapter {
  readonly mode = 'demo' as const;
  private state: AppState;
  /** Persistence sink. Defaults to web localStorage; platforms (e.g. React Native)
   *  can inject their own (AsyncStorage) so the SAME rules run with native storage. */
  private persistFn: (s: AppState) => void;

  // Platform-neutral: no web storage import here. The caller supplies the initial
  // state and a persistence sink (web localStorage or React Native AsyncStorage).
  constructor(initial?: AppState, persistFn?: (s: AppState) => void) {
    this.state = initial ?? buildSeedState(kampalaToday());
    this.persistFn = persistFn ?? (() => {});
  }

  /** For tests: operate on an explicit seed. */
  static withState(state: AppState): DemoAdapter {
    return new DemoAdapter(state);
  }

  private persist() {
    // Persist through the injected sink (web localStorage by default; a no-op in
    // unit tests). Wrapped so a storage failure never breaks the demo in-memory.
    try {
      this.persistFn(this.state);
    } catch {
      /* ignore */
    }
  }

  private tripView(tripId: string): TripView | null {
    const t = this.state.trips.find((x) => x.id === tripId);
    if (!t) return null;
    const op = operatorById(this.state, t.operatorId);
    const stops: TripStopView[] = t.stops.map((s) => {
      const hub = this.state.hubs.find((h) => h.id === s.hubId);
      return {
        id: stopId(t.id, s.hubId),
        tripId: t.id,
        hubId: s.hubId,
        hubName: hub?.name ?? 'Hub',
        hubCity: hub?.city ?? '',
        stopOrder: s.order,
        pickupTime: shiftMinutes(s.pickupTime, t.delayMinutes),
        reached: s.reached,
      };
    });
    const reserved = logic.seatsReserved(this.state, t.id);
    const staff = this.state.staff ?? [];
    const driver = staff.find((s) => s.role === 'driver' && s.assignedTripIds.includes(t.id));
    const conductor = staff.find((s) => s.role === 'conductor' && s.assignedTripIds.includes(t.id));
    return {
      id: t.id,
      operatorId: t.operatorId,
      operatorName: op?.name ?? 'Operator',
      vehicleLabel: this.state.vehicles.find((v) => v.id === t.vehicleId)?.label,
      driverName: driver?.name,
      conductorName: conductor?.name,
      direction: t.direction,
      serviceDate: t.date,
      originDeparture: t.originDeparture,
      destinationArrival: logic.effectiveArrival(t),
      fareUgx: t.farePerSeat,
      capacity: t.capacity,
      status: t.status,
      delayMinutes: t.delayMinutes,
      progress: t.progress,
      lastUpdate: t.lastUpdate,
      seatsReserved: reserved,
      seatsAvailable: logic.availableSeats(this.state, t),
      stops,
    };
  }

  private bookingView(bookingId: string): BookingView | null {
    const b = this.state.bookings.find((x) => x.id === bookingId);
    if (!b) return null;
    const t = this.state.trips.find((x) => x.id === b.tripId);
    const lastStop = t?.stops[t.stops.length - 1];
    return {
      id: b.id,
      tripId: b.tripId,
      reference: b.reference,
      boardingCredential: b.boardingCode,
      seats: b.seats,
      status: b.status,
      paymentStatus: 'pay_at_boarding',
      fareUgxSnapshot: t?.farePerSeat ?? 0,
      pickupHubId: b.pickupHubId,
      dropoffHubId: lastStop?.hubId ?? b.pickupHubId,
      pickupTimeSnapshot: logic.effectivePickupTime(t!, b.pickupHubId) ?? b.createdAt,
      dropoffTimeSnapshot: t ? logic.effectiveArrival(t) : b.createdAt,
      passengerName: b.passengerName,
      unresolved: !!b.unresolved,
      createdAt: b.createdAt,
    };
  }

  private apply<T>(r: logic.Result<T>): T {
    if (!r.ok) throw new AdapterError('DEMO', r.error);
    this.state = r.state;
    this.persist();
    return r.value;
  }

  async listHubs(): Promise<HubView[]> {
    return this.state.hubs.map((h) => ({
      id: h.id, name: h.name, city: h.city, area: h.area,
      arrivalInstructions: h.arrivalInstructions, openingHours: h.openingHours,
      facilities: h.facilities as unknown as Record<string, boolean>, isDemo: true,
    }));
  }

  async searchTrips(q: TripSearch): Promise<TripView[]> {
    return this.state.trips
      .filter((t) => t.direction === q.direction && t.date === q.date)
      .filter((t) => t.status !== 'cancelled')
      .filter((t) => (q.hubId ? t.stops.some((s) => s.hubId === q.hubId) : true))
      .map((t) => this.tripView(t.id)!)
      .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture));
  }

  async getTrip(tripId: string): Promise<TripView | null> {
    return this.tripView(tripId);
  }

  async reserve(input: ReserveInput): Promise<BookingView> {
    const { hubId } = parseStop(input.pickupStopId);
    const booking = this.apply(
      logic.reserve(this.state, {
        tripId: input.tripId,
        pickupHubId: hubId,
        passengerName: input.passengerName,
        phone: input.passengerPhone,
        seats: input.seats,
      }),
    );
    return this.bookingView(booking.id)!;
  }

  async myBookings(): Promise<BookingView[]> {
    return this.state.bookings
      .map((b) => this.bookingView(b.id)!)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getBooking(bookingId: string): Promise<BookingView | null> {
    return this.bookingView(bookingId);
  }
  async cancelBooking(bookingId: string): Promise<BookingView> {
    this.apply(logic.cancelBooking(this.state, bookingId));
    return this.bookingView(bookingId)!;
  }
  async checkIn(bookingId: string): Promise<BookingView> {
    this.apply(logic.checkIn(this.state, bookingId));
    return this.bookingView(bookingId)!;
  }
  async listStaff(): Promise<StaffView[]> {
    const staff = this.state.staff ?? [];
    return staff.map((s) => {
      const op = s.operatorId ? operatorById(this.state, s.operatorId) : undefined;
      const hub = s.assignedHubId ? this.state.hubs.find((h) => h.id === s.assignedHubId) : undefined;
      return {
        id: s.id, name: s.name, role: s.role, phone: s.phone,
        operatorId: s.operatorId, operatorName: op?.name,
        assignedTripCount: s.assignedTripIds.length,
        assignedHubId: s.assignedHubId, assignedHubName: hub?.name,
      };
    });
  }
  async staffTrips(staffId: string): Promise<TripView[]> {
    const s = (this.state.staff ?? []).find((x) => x.id === staffId);
    if (!s) return [];
    return s.assignedTripIds
      .map((id) => this.tripView(id))
      .filter((t): t is TripView => !!t)
      .sort((a, b) => a.originDeparture.localeCompare(b.originDeparture));
  }
  async attendantHubId(staffId: string): Promise<string | null> {
    const s = (this.state.staff ?? []).find((x) => x.id === staffId);
    return s?.assignedHubId ?? null;
  }

  async checkInByReference(reference: string): Promise<BookingView> {
    const b = this.apply(logic.checkInByReference(this.state, reference));
    return this.bookingView(b.id)!;
  }

  async getTripManifest(tripId: string): Promise<ManifestRow[]> {
    return this.state.bookings
      .filter((b) => b.tripId === tripId && b.status !== 'cancelled')
      .map((b) => {
        const t = this.state.trips.find((x) => x.id === tripId);
        const order = t?.stops.find((s) => s.hubId === b.pickupHubId)?.order ?? 0;
        return {
          bookingId: b.id, reference: b.reference, passengerName: b.passengerName,
          seats: b.seats, status: b.status, pickupHubId: b.pickupHubId,
          pickupStopOrder: order, unresolved: !!b.unresolved,
        };
      })
      .sort((a, b) => a.pickupStopOrder - b.pickupStopOrder);
  }
  async getHubExpected(hubId: string): Promise<HubExpectedRow[]> {
    return this.state.bookings
      .filter((b) => b.pickupHubId === hubId && ['reserved', 'checked_in', 'boarded'].includes(b.status))
      .map((b) => {
        const t = this.state.trips.find((x) => x.id === b.tripId);
        return {
          bookingId: b.id, reference: b.reference, passengerName: b.passengerName,
          seats: b.seats, status: b.status, tripId: b.tripId,
          pickupTime: t ? (logic.effectivePickupTime(t, hubId) ?? b.createdAt) : b.createdAt,
        };
      });
  }
  async hubIncidents(hubId: string): Promise<HubExpectedRow[]> {
    return this.state.bookings
      .filter((b) => b.pickupHubId === hubId && (b.unresolved || b.status === 'missed_pickup'))
      .map((b) => {
        const t = this.state.trips.find((x) => x.id === b.tripId);
        return {
          bookingId: b.id, reference: b.reference, passengerName: b.passengerName,
          seats: b.seats, status: b.status, tripId: b.tripId,
          pickupTime: t ? (logic.effectivePickupTime(t, hubId) ?? b.createdAt) : b.createdAt,
        };
      });
  }
  async resolveBoarding(tripId: string, credential: string): Promise<BookingView> {
    const code = credential.replace(/^TOGO:/i, '').trim();
    const t = this.state.trips.find((x) => x.id === tripId);
    if (!t) throw new AdapterError('INVALID_CODE', 'Unknown trip.');
    const b = this.state.bookings.find((x) => x.tripId === tripId && x.boardingCode === code);
    if (!b) {
      const other = this.state.bookings.find((x) => x.boardingCode === code);
      if (other) throw new AdapterError('WRONG_TRIP', 'That code belongs to a different trip.');
      throw new AdapterError('INVALID_CODE', 'That boarding code was not recognised.');
    }
    if (b.status === 'cancelled') throw new AdapterError('CANCELLED', 'That booking was cancelled.');
    if (b.status === 'boarded' || b.status === 'completed') throw new AdapterError('ALREADY_BOARDED', 'That passenger is already boarded.');
    return this.bookingView(b.id)!;
  }
  async boardByCredential(tripId: string, credential: string): Promise<BookingView> {
    const b = this.apply(logic.boardByCode(this.state, tripId, credential));
    return this.bookingView(b.id)!;
  }
  async updateTripStatus(tripId: string, status: TripStatusCode): Promise<TripView> {
    if (status === 'completed') this.apply(logic.completeTrip(this.state, tripId));
    else if (status === 'en_route') this.apply(logic.startTrip(this.state, tripId));
    else this.apply(logic.setBoarding(this.state, tripId));
    return this.tripView(tripId)!;
  }
  async reportDelay(tripId: string, minutes: number): Promise<TripView> {
    this.apply(logic.reportDelay(this.state, tripId, minutes));
    return this.tripView(tripId)!;
  }
  async reachHub(tripId: string, hubId: string): Promise<TripView> {
    this.apply(logic.reachHub(this.state, tripId, hubId));
    return this.tripView(tripId)!;
  }
  async cancelTrip(tripId: string, reason: string): Promise<TripView> {
    this.apply(logic.cancelTrip(this.state, tripId, reason));
    return this.tripView(tripId)!;
  }
  async recordUnresolvedPickup(tripId: string, hubId: string, reason: string): Promise<number> {
    return this.apply(logic.recordUnresolvedPickup(this.state, tripId, hubId, reason));
  }
  async operatorUpdateTrip(
    tripId: string,
    patch: { fareUgx?: number; capacity?: number; status?: TripStatusCode; originDeparture?: string },
  ): Promise<TripView> {
    this.apply(
      logic.editTrip(this.state, tripId, {
        farePerSeat: patch.fareUgx,
        capacity: patch.capacity,
        status: patch.status,
        originDeparture: patch.originDeparture,
      }),
    );
    return this.tripView(tripId)!;
  }

  // Location + notifications are simulated-only in demo mode.
  async reportLocation(): Promise<void> {
    /* demo mode uses the simulated schematic, not real coordinates */
  }
  async latestLocation(): Promise<LocationView | null> {
    return null;
  }
  async listNotifications(): Promise<NotificationView[]> {
    return this.state.activity.slice(0, 30).map((e) => ({
      id: e.id, kind: e.kind, title: e.kind.replace(/_/g, ' '), body: e.message,
      tripId: e.tripId ?? null, bookingId: e.bookingId ?? null, readAt: null, createdAt: e.at,
    }));
  }
  async markNotificationRead(): Promise<void> {
    /* no-op in demo */
  }

  subscribeMyBookings(): Subscription {
    return NOOP;
  }
  subscribeTrip(): Subscription {
    return NOOP;
  }
}

/** Convenience seed for tests. */
export function freshDemoAdapter(): DemoAdapter {
  return DemoAdapter.withState(buildSeedState(kampalaToday()));
}
