import type { SupabaseClient } from '@supabase/supabase-js';
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
  type Subscription,
  type TripSearch,
  type TripStatusCode,
  type TripStopView,
  type TripView,
} from './adapter';

// Parse "CODE: message" from a PostgREST/RPC error into a stable code.
function toAdapterError(err: unknown): AdapterError {
  const raw =
    (err as { message?: string })?.message ??
    (typeof err === 'string' ? err : 'Something went wrong');
  const m = /^([A-Z_]+):?\s*(.*)$/.exec(raw);
  if (m) return new AdapterError(m[1], m[2] || raw);
  return new AdapterError('ERROR', raw);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapTrip(row: any, stops: TripStopView[]): TripView {
  return {
    id: row.id,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    vehicleLabel: row.vehicle_label ?? undefined,
    direction: row.direction,
    serviceDate: row.service_date,
    originDeparture: row.origin_departure,
    destinationArrival: row.destination_arrival,
    fareUgx: row.fare_ugx,
    capacity: row.capacity,
    status: row.status,
    delayMinutes: row.delay_minutes,
    progress: Number(row.progress ?? 0),
    lastUpdate: row.last_update,
    seatsReserved: row.seats_reserved ?? 0,
    seatsAvailable: row.seats_available ?? row.capacity,
    stops,
  };
}

function mapStop(row: any): TripStopView {
  return {
    id: row.id,
    tripId: row.trip_id,
    hubId: row.hub_id,
    hubName: row.hub_name,
    hubCity: row.hub_city,
    stopOrder: row.stop_order,
    pickupTime: row.pickup_time,
    reached: row.reached,
  };
}

function mapBooking(row: any): BookingView {
  return {
    id: row.id,
    tripId: row.trip_id,
    reference: row.reference,
    boardingCredential: row.boarding_credential,
    seats: row.seats,
    status: row.status,
    paymentStatus: row.payment_status,
    fareUgxSnapshot: row.fare_ugx_snapshot,
    pickupHubId: row.pickup_hub_id,
    dropoffHubId: row.dropoff_hub_id,
    pickupTimeSnapshot: row.pickup_time_snapshot,
    dropoffTimeSnapshot: row.dropoff_time_snapshot,
    passengerName: row.passenger_name,
    unresolved: row.unresolved,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export class SupabaseAdapter implements DataAdapter {
  readonly mode = 'connected' as const;
  constructor(private sb: SupabaseClient) {}

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw toAdapterError(error);
    return data as T;
  }

  async listHubs(): Promise<HubView[]> {
    const { data, error } = await this.sb.from('hubs_public').select('*').order('city');
    if (error) throw toAdapterError(error);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return (data ?? []).map((h: any) => ({
      id: h.id, name: h.name, city: h.city, area: h.area,
      arrivalInstructions: h.arrival_instructions, openingHours: h.opening_hours,
      facilities: h.facilities, isDemo: h.is_demo,
    }));
  }

  private async stopsFor(tripIds: string[]): Promise<Map<string, TripStopView[]>> {
    const map = new Map<string, TripStopView[]>();
    if (tripIds.length === 0) return map;
    const { data, error } = await this.sb
      .from('trip_stops_public').select('*').in('trip_id', tripIds).order('stop_order');
    if (error) throw toAdapterError(error);
    for (const row of data ?? []) {
      const s = mapStop(row);
      const arr = map.get(s.tripId) ?? [];
      arr.push(s);
      map.set(s.tripId, arr);
    }
    return map;
  }

  async searchTrips(q: TripSearch): Promise<TripView[]> {
    const { data, error } = await this.sb
      .from('trips_public').select('*')
      .eq('direction', q.direction).eq('service_date', q.date)
      .order('origin_departure');
    if (error) throw toAdapterError(error);
    const rows = data ?? [];
    const stops = await this.stopsFor(rows.map((r: { id: string }) => r.id));
    let trips = rows.map((r: unknown) => mapTrip(r, stops.get((r as { id: string }).id) ?? []));
    if (q.hubId) trips = trips.filter((t) => t.stops.some((s) => s.hubId === q.hubId));
    return trips;
  }

  async getTrip(tripId: string): Promise<TripView | null> {
    const { data, error } = await this.sb.from('trips_public').select('*').eq('id', tripId).maybeSingle();
    if (error) throw toAdapterError(error);
    if (!data) return null;
    const stops = await this.stopsFor([tripId]);
    return mapTrip(data, stops.get(tripId) ?? []);
  }

  async reserve(input: ReserveInput): Promise<BookingView> {
    return mapBooking(await this.rpc('reserve_booking', {
      p_trip_id: input.tripId,
      p_pickup_stop_id: input.pickupStopId,
      p_dropoff_stop_id: input.dropoffStopId,
      p_seats: input.seats,
      p_passenger_name: input.passengerName,
      p_passenger_phone: input.passengerPhone ?? null,
      p_idempotency_key: input.idempotencyKey,
    }));
  }

  async myBookings(): Promise<BookingView[]> {
    const { data, error } = await this.sb.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) throw toAdapterError(error);
    return (data ?? []).map(mapBooking);
  }

  async getBooking(bookingId: string): Promise<BookingView | null> {
    const { data, error } = await this.sb.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (error) throw toAdapterError(error);
    return data ? mapBooking(data) : null;
  }

  async cancelBooking(bookingId: string): Promise<BookingView> {
    return mapBooking(await this.rpc('cancel_booking', { p_booking_id: bookingId }));
  }
  async checkIn(bookingId: string): Promise<BookingView> {
    return mapBooking(await this.rpc('check_in_booking', { p_booking_id: bookingId }));
  }
  async checkInByReference(reference: string): Promise<BookingView> {
    return mapBooking(await this.rpc('check_in_by_reference', { p_reference: reference }));
  }

  async getTripManifest(tripId: string): Promise<ManifestRow[]> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const rows = await this.rpc<any[]>('get_trip_manifest', { p_trip_id: tripId });
    return (rows ?? []).map((r) => ({
      bookingId: r.booking_id, reference: r.reference, passengerName: r.passenger_name,
      seats: r.seats, status: r.status, pickupHubId: r.pickup_hub_id,
      pickupStopOrder: r.pickup_stop_order, unresolved: r.unresolved,
    }));
  }
  async getHubExpected(hubId: string): Promise<HubExpectedRow[]> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const rows = await this.rpc<any[]>('get_hub_expected', { p_hub_id: hubId });
    return (rows ?? []).map((r) => ({
      bookingId: r.booking_id, reference: r.reference, passengerName: r.passenger_name,
      seats: r.seats, status: r.status, tripId: r.trip_id, pickupTime: r.pickup_time,
    }));
  }
  async boardByCredential(tripId: string, credential: string): Promise<BookingView> {
    return mapBooking(await this.rpc('board_booking', { p_trip_id: tripId, p_credential: credential }));
  }
  async updateTripStatus(tripId: string, status: TripStatusCode): Promise<TripView> {
    await this.rpc('update_trip_status', { p_trip_id: tripId, p_status: status });
    return (await this.getTrip(tripId))!;
  }
  async reportDelay(tripId: string, minutes: number): Promise<TripView> {
    await this.rpc('report_delay', { p_trip_id: tripId, p_minutes: minutes });
    return (await this.getTrip(tripId))!;
  }
  async reachHub(tripId: string, hubId: string): Promise<TripView> {
    await this.rpc('reach_hub', { p_trip_id: tripId, p_hub_id: hubId });
    return (await this.getTrip(tripId))!;
  }
  async cancelTrip(tripId: string, reason: string): Promise<TripView> {
    await this.rpc('cancel_trip', { p_trip_id: tripId, p_reason: reason });
    return (await this.getTrip(tripId))!;
  }
  async recordUnresolvedPickup(tripId: string, hubId: string, reason: string): Promise<number> {
    return await this.rpc('record_unresolved_pickup', { p_trip_id: tripId, p_hub_id: hubId, p_reason: reason });
  }
  async operatorUpdateTrip(
    tripId: string,
    patch: { fareUgx?: number; capacity?: number; status?: TripStatusCode; originDeparture?: string },
  ): Promise<TripView> {
    await this.rpc('operator_update_trip', {
      p_trip_id: tripId,
      p_fare_ugx: patch.fareUgx ?? null,
      p_capacity: patch.capacity ?? null,
      p_status: patch.status ?? null,
      p_origin_departure: patch.originDeparture ?? null,
    });
    return (await this.getTrip(tripId))!;
  }

  async reportLocation(tripId: string, lat: number, lng: number, accuracy: number | null, observedAt: string): Promise<void> {
    await this.rpc('report_location', {
      p_trip_id: tripId, p_lat: lat, p_lng: lng, p_accuracy: accuracy, p_observed_at: observedAt,
    });
  }
  async latestLocation(tripId: string): Promise<LocationView | null> {
    const { data, error } = await this.sb
      .from('location_updates').select('*').eq('trip_id', tripId)
      .order('received_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw toAdapterError(error);
    if (!data) return null;
    return { lat: Number(data.lat), lng: Number(data.lng), accuracyM: data.accuracy_m,
      observedAt: data.observed_at, receivedAt: data.received_at };
  }

  async listNotifications(): Promise<NotificationView[]> {
    const { data, error } = await this.sb.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw toAdapterError(error);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return (data ?? []).map((n: any) => ({
      id: n.id, kind: n.kind, title: n.title, body: n.body,
      tripId: n.trip_id, bookingId: n.booking_id, readAt: n.read_at, createdAt: n.created_at,
    }));
  }
  async markNotificationRead(id: string): Promise<void> {
    await this.rpc('mark_notification_read', { p_id: id });
  }

  subscribeMyBookings(onChange: () => void): Subscription {
    const ch = this.sb
      .channel('my-bookings-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
      .subscribe();
    return { unsubscribe: () => { this.sb.removeChannel(ch); } };
  }
  subscribeTrip(tripId: string, onChange: () => void): Subscription {
    const ch = this.sb
      .channel('trip-' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_events', filter: `trip_id=eq.${tripId}` }, onChange)
      .subscribe();
    return { unsubscribe: () => { this.sb.removeChannel(ch); } };
  }
}
