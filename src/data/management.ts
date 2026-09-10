// Connected-mode operational management API. Wraps the SECURITY DEFINER RPCs and
// admin/operator reads. Used only by the admin/operator management screens (not by
// the shared passenger/staff data adapter). Every write goes through an RPC whose
// authority is enforced in the database.
import { requireSupabase } from '../lib/supabase';
import { AdapterError } from './adapter';

/* eslint-disable @typescript-eslint/no-explicit-any */
function fail(err: unknown): never {
  const raw = (err as { message?: string })?.message ?? String(err);
  const m = /^([A-Z_]+):?\s*(.*)$/.exec(raw);
  throw new AdapterError(m ? m[1] : 'ERROR', m ? m[2] || raw : raw);
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(fn, args);
  if (error) fail(error);
  return data as T;
}
async function select<T>(table: string, build?: (q: any) => any): Promise<T[]> {
  let q = requireSupabase().from(table).select('*');
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) fail(error);
  return (data ?? []) as T[];
}

export interface OperatorRow { id: string; name: string; slug: string; rating: number; is_active: boolean; }
export interface HubRow {
  id: string; name: string; city: string; area: string; approval_status: string;
  is_active: boolean; is_demo: boolean; internal_notes: string | null; opening_hours: string;
  arrival_instructions: string; approved_at: string | null;
}
export interface VehicleRow { id: string; operator_id: string; label: string; plate: string; capacity: number; }
export interface RouteRow { id: string; operator_id: string; direction: string; origin_city: string; destination_city: string; is_active: boolean; }
export interface RouteStopRow { id: string; route_id: string; hub_id: string; stop_order: number; }
export interface IncidentRow {
  id: string; kind: string; trip_id: string | null; hub_id: string | null; operator_id: string | null;
  status: string; staff_notes: string | null; passenger_message: string | null; resolution: string | null;
  created_at: string; resolved_at: string | null;
}
export interface MemberRow { operator_id: string; user_id: string; role: string; }
export interface HubStaffRow { hub_id: string; user_id: string; }
export interface TripStaffRow { trip_id: string; user_id: string; role: string; }

export const management = {
  // ---- reads ----
  listOperators: () => select<OperatorRow>('operators', (q) => q.order('name')),
  listHubs: () => select<HubRow>('hubs', (q) => q.order('city')),
  listVehicles: (operatorId: string) => select<VehicleRow>('vehicles', (q) => q.eq('operator_id', operatorId).order('label')),
  listRoutes: (operatorId: string) => select<RouteRow>('routes', (q) => q.eq('operator_id', operatorId)),
  listRouteStops: (routeId: string) => select<RouteStopRow>('route_stops', (q) => q.eq('route_id', routeId).order('stop_order')),
  listOperatorTrips: (operatorId: string) =>
    select<any>('trips', (q) => q.eq('operator_id', operatorId).order('origin_departure', { ascending: false })),
  listIncidents: () => select<IncidentRow>('incidents', (q) => q.order('created_at', { ascending: false })),
  listMembers: (operatorId: string) => select<MemberRow>('operator_members', (q) => q.eq('operator_id', operatorId)),
  listHubStaff: (hubId: string) => select<HubStaffRow>('hub_staff', (q) => q.eq('hub_id', hubId)),
  listTripStaff: (tripId: string) => select<TripStaffRow>('trip_staff', (q) => q.eq('trip_id', tripId)),

  // ---- admin writes ----
  createOperator: (name: string, slug: string) => rpc<OperatorRow>('admin_create_operator', { p_name: name, p_slug: slug }),
  updateOperator: (id: string, p: { name?: string; rating?: number; is_active?: boolean }) =>
    rpc<OperatorRow>('admin_update_operator', { p_id: id, p_name: p.name ?? null, p_rating: p.rating ?? null, p_is_active: p.is_active ?? null }),
  createHub: (h: { name: string; city: string; area: string; arrival_instructions?: string; opening_hours?: string }) =>
    rpc<HubRow>('admin_create_hub', {
      p_name: h.name, p_city: h.city, p_area: h.area,
      p_arrival_instructions: h.arrival_instructions ?? '', p_opening_hours: h.opening_hours ?? '', p_facilities: {},
    }),
  updateHub: (id: string, p: { name?: string; city?: string; area?: string; is_active?: boolean }) =>
    rpc<HubRow>('admin_update_hub', {
      p_id: id, p_name: p.name ?? null, p_city: p.city ?? null, p_area: p.area ?? null,
      p_arrival_instructions: null, p_opening_hours: null, p_facilities: null, p_is_active: p.is_active ?? null,
    }),
  setHubApproval: (id: string, status: string, note?: string) =>
    rpc<HubRow>('admin_set_hub_approval', { p_id: id, p_status: status, p_note: note ?? null }),
  assignOperatorMember: (operatorId: string, userId: string, role = 'staff') =>
    rpc<void>('admin_assign_operator_member', { p_operator_id: operatorId, p_user_id: userId, p_role: role }),
  removeOperatorMember: (operatorId: string, userId: string) =>
    rpc<void>('admin_remove_operator_member', { p_operator_id: operatorId, p_user_id: userId }),
  assignHubStaff: (hubId: string, userId: string) => rpc<void>('admin_assign_hub_staff', { p_hub_id: hubId, p_user_id: userId }),
  removeHubStaff: (hubId: string, userId: string) => rpc<void>('admin_remove_hub_staff', { p_hub_id: hubId, p_user_id: userId }),
  setPlatformAdmin: (userId: string, value: boolean) => rpc<void>('admin_set_platform_admin', { p_user_id: userId, p_value: value }),

  // ---- operator writes ----
  createVehicle: (operatorId: string, label: string, plate: string, capacity: number) =>
    rpc<VehicleRow>('operator_create_vehicle', { p_operator_id: operatorId, p_label: label, p_plate: plate, p_capacity: capacity }),
  updateVehicle: (id: string, p: { label?: string; plate?: string; capacity?: number }) =>
    rpc<VehicleRow>('operator_update_vehicle', { p_id: id, p_label: p.label ?? null, p_plate: p.plate ?? null, p_capacity: p.capacity ?? null }),
  createRoute: (operatorId: string, direction: string, originCity: string, destCity: string) =>
    rpc<RouteRow>('operator_create_route', { p_operator_id: operatorId, p_direction: direction, p_origin_city: originCity, p_destination_city: destCity }),
  setRouteStops: (routeId: string, hubIds: string[]) => rpc<void>('operator_set_route_stops', { p_route_id: routeId, p_hub_ids: hubIds }),
  createDeparture: (p: {
    operatorId: string; routeId: string; vehicleId: string | null; serviceDate: string;
    originDeparture: string; fareUgx: number; capacity: number; cutoffMinutes: number; pickupTimes: string[];
  }) => rpc<any>('operator_create_departure', {
    p_operator_id: p.operatorId, p_route_id: p.routeId, p_vehicle_id: p.vehicleId, p_service_date: p.serviceDate,
    p_origin_departure: p.originDeparture, p_fare_ugx: p.fareUgx, p_capacity: p.capacity,
    p_cutoff_minutes: p.cutoffMinutes, p_pickup_times: p.pickupTimes,
  }),
  assignConductor: (tripId: string, userId: string) => rpc<void>('operator_assign_conductor', { p_trip_id: tripId, p_user_id: userId }),
  removeConductor: (tripId: string, userId: string) => rpc<void>('operator_remove_conductor', { p_trip_id: tripId, p_user_id: userId }),

  // ---- incidents ----
  reportIncident: (p: { kind: string; tripId?: string; hubId?: string; bookingId?: string; staffNotes?: string; passengerMessage?: string }) =>
    rpc<IncidentRow>('report_incident', {
      p_kind: p.kind, p_trip_id: p.tripId ?? null, p_hub_id: p.hubId ?? null,
      p_booking_id: p.bookingId ?? null, p_staff_notes: p.staffNotes ?? null, p_passenger_message: p.passengerMessage ?? null,
    }),
  resolveIncident: (id: string, resolution: string) => rpc<IncidentRow>('resolve_incident', { p_id: id, p_resolution: resolution }),
  updateIncident: (id: string, p: { status?: string; staffNotes?: string; passengerMessage?: string }) =>
    rpc<IncidentRow>('update_incident', { p_id: id, p_status: p.status ?? null, p_staff_notes: p.staffNotes ?? null, p_passenger_message: p.passengerMessage ?? null }),
};
