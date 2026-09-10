-- 0013 Operational management RPCs + incident workflow + explicit unboarded
-- handling at trip completion. All are SECURITY DEFINER with fixed search_path,
-- restricted EXECUTE, and explicit authority checks on the caller's JWT identity.
--
-- Authority separation:
--   * Platform admin: operators, hubs (incl. approval), operator memberships,
--     hub-staff assignments, platform config.
--   * Operator staff: only their own operator's vehicles, routes, departures,
--     conductor assignments, delays, cancellations. They can NEVER approve hubs
--     or grant themselves platform privileges.

-- ======================= admin: operators =======================
create or replace function public.admin_create_operator(p_name text, p_slug text)
returns public.operators
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.operators;
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  insert into public.operators (name, slug) values (trim(p_name), lower(trim(p_slug))) returning * into v_row;
  return v_row;
end; $$;

create or replace function public.admin_update_operator(
  p_id uuid, p_name text default null, p_rating numeric default null, p_is_active boolean default null)
returns public.operators
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.operators;
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  update public.operators set
    name = coalesce(p_name, name),
    rating = coalesce(p_rating, rating),
    is_active = coalesce(p_is_active, is_active)
  where id = p_id returning * into v_row;
  if not found then raise exception 'OPERATOR_NOT_FOUND'; end if;
  return v_row;
end; $$;

-- ======================= admin: hubs (incl. approval) =======================
create or replace function public.admin_create_hub(
  p_name text, p_city text, p_area text, p_arrival_instructions text default '',
  p_opening_hours text default '', p_facilities jsonb default '{}'::jsonb)
returns public.hubs
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.hubs;
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  insert into public.hubs (name, city, area, arrival_instructions, opening_hours, facilities, approval_status, is_active, is_demo)
  values (trim(p_name), trim(p_city), trim(p_area), coalesce(p_arrival_instructions,''), coalesce(p_opening_hours,''),
          coalesce(p_facilities,'{}'::jsonb), 'draft', true, false)
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.admin_update_hub(
  p_id uuid, p_name text default null, p_city text default null, p_area text default null,
  p_arrival_instructions text default null, p_opening_hours text default null,
  p_facilities jsonb default null, p_is_active boolean default null)
returns public.hubs
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.hubs;
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  update public.hubs set
    name = coalesce(p_name, name), city = coalesce(p_city, city), area = coalesce(p_area, area),
    arrival_instructions = coalesce(p_arrival_instructions, arrival_instructions),
    opening_hours = coalesce(p_opening_hours, opening_hours),
    facilities = coalesce(p_facilities, facilities),
    is_active = coalesce(p_is_active, is_active)
  where id = p_id returning * into v_row;
  if not found then raise exception 'HUB_NOT_FOUND'; end if;
  return v_row;
end; $$;

-- Approval is an INTERNAL record of a real-world decision made off-platform. It is
-- admin-only; an operator can never approve a hub (including one it uses).
create or replace function public.admin_set_hub_approval(p_id uuid, p_status hub_approval, p_note text default null)
returns public.hubs
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.hubs;
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  update public.hubs set
    approval_status = p_status,
    approved_by = case when p_status = 'approved' then v_uid else null end,
    approved_at = case when p_status = 'approved' then now() else null end,
    internal_notes = coalesce(p_note, internal_notes)
  where id = p_id returning * into v_row;
  if not found then raise exception 'HUB_NOT_FOUND'; end if;
  return v_row;
end; $$;

-- ======================= admin: staff assignments =======================
create or replace function public.admin_assign_operator_member(p_operator_id uuid, p_user_id uuid, p_role operator_role default 'staff')
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  insert into public.operator_members (operator_id, user_id, role) values (p_operator_id, p_user_id, p_role)
  on conflict (operator_id, user_id) do update set role = excluded.role;
end; $$;

create or replace function public.admin_remove_operator_member(p_operator_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  delete from public.operator_members where operator_id = p_operator_id and user_id = p_user_id;
end; $$;

create or replace function public.admin_assign_hub_staff(p_hub_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  insert into public.hub_staff (hub_id, user_id) values (p_hub_id, p_user_id) on conflict do nothing;
end; $$;

create or replace function public.admin_remove_hub_staff(p_hub_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then raise exception 'FORBIDDEN: admin required'; end if;
  delete from public.hub_staff where hub_id = p_hub_id and user_id = p_user_id;
end; $$;

-- ======================= operator: vehicles =======================
create or replace function public.operator_create_vehicle(p_operator_id uuid, p_label text, p_plate text, p_capacity integer)
returns public.vehicles
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.vehicles;
begin
  if v_uid is null or not public.is_operator_member(v_uid, p_operator_id) then raise exception 'FORBIDDEN'; end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 200 then raise exception 'INVALID_CAPACITY'; end if;
  insert into public.vehicles (operator_id, label, plate, capacity) values (p_operator_id, trim(p_label), trim(p_plate), p_capacity)
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.operator_update_vehicle(p_id uuid, p_label text default null, p_plate text default null, p_capacity integer default null)
returns public.vehicles
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.vehicles;
begin
  select * into v_row from public.vehicles where id = p_id;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if v_uid is null or not public.is_operator_member(v_uid, v_row.operator_id) then raise exception 'FORBIDDEN'; end if;
  if p_capacity is not null and (p_capacity < 1 or p_capacity > 200) then raise exception 'INVALID_CAPACITY'; end if;
  update public.vehicles set label = coalesce(p_label,label), plate = coalesce(p_plate,plate), capacity = coalesce(p_capacity,capacity)
  where id = p_id returning * into v_row;
  return v_row;
end; $$;

-- ======================= operator: routes + ordered stops =======================
create or replace function public.operator_create_route(p_operator_id uuid, p_direction direction, p_origin_city text, p_destination_city text)
returns public.routes
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.routes;
begin
  if v_uid is null or not public.is_operator_member(v_uid, p_operator_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.routes (operator_id, direction, origin_city, destination_city)
  values (p_operator_id, p_direction, trim(p_origin_city), trim(p_destination_city)) returning * into v_row;
  return v_row;
end; $$;

-- Replace a route's ordered stops. Operators may only use APPROVED, active hubs —
-- they cannot smuggle in an unapproved hub (they cannot approve hubs themselves).
create or replace function public.operator_set_route_stops(p_route_id uuid, p_hub_ids uuid[])
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_op uuid; v_hub uuid; i int;
begin
  select operator_id into v_op from public.routes where id = p_route_id;
  if v_op is null then raise exception 'ROUTE_NOT_FOUND'; end if;
  if v_uid is null or not public.is_operator_member(v_uid, v_op) then raise exception 'FORBIDDEN'; end if;
  if array_length(p_hub_ids, 1) is null or array_length(p_hub_ids, 1) < 2 then raise exception 'ROUTE_NEEDS_2_STOPS'; end if;
  foreach v_hub in array p_hub_ids loop
    if not exists (select 1 from public.hubs where id = v_hub and approval_status = 'approved' and is_active) then
      raise exception 'HUB_NOT_BOOKABLE: hub % is not approved/active', v_hub;
    end if;
  end loop;
  delete from public.route_stops where route_id = p_route_id;
  i := 0;
  foreach v_hub in array p_hub_ids loop
    insert into public.route_stops (route_id, hub_id, stop_order) values (p_route_id, v_hub, i);
    i := i + 1;
  end loop;
end; $$;

-- ======================= operator: departures (trips + stops) =======================
create or replace function public.operator_create_departure(
  p_operator_id uuid, p_route_id uuid, p_vehicle_id uuid, p_service_date date,
  p_origin_departure timestamptz, p_fare_ugx integer, p_capacity integer,
  p_cutoff_minutes integer, p_pickup_times timestamptz[])
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_route public.routes; v_trip public.trips;
  v_hub_ids uuid[]; v_n int; i int;
begin
  if v_uid is null or not public.is_operator_member(v_uid, p_operator_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_route from public.routes where id = p_route_id;
  if not found or v_route.operator_id <> p_operator_id then raise exception 'ROUTE_NOT_FOUND'; end if;
  if p_vehicle_id is not null and not exists (select 1 from public.vehicles where id = p_vehicle_id and operator_id = p_operator_id) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;
  if p_fare_ugx is null or p_fare_ugx < 0 then raise exception 'INVALID_FARE'; end if;
  if p_capacity is null or p_capacity < 1 then raise exception 'INVALID_CAPACITY'; end if;

  select array_agg(hub_id order by stop_order) into v_hub_ids from public.route_stops where route_id = p_route_id;
  v_n := coalesce(array_length(v_hub_ids, 1), 0);
  if v_n < 2 then raise exception 'ROUTE_NEEDS_2_STOPS'; end if;
  if array_length(p_pickup_times, 1) is distinct from v_n then raise exception 'PICKUP_TIMES_MISMATCH: expected % times', v_n; end if;

  insert into public.trips (operator_id, route_id, vehicle_id, direction, service_date, origin_departure,
    destination_arrival, fare_ugx, capacity, status, booking_cutoff_minutes)
  values (p_operator_id, p_route_id, p_vehicle_id, v_route.direction, p_service_date, p_origin_departure,
    p_pickup_times[v_n], p_fare_ugx, p_capacity, 'scheduled', greatest(0, coalesce(p_cutoff_minutes,0)))
  returning * into v_trip;

  for i in 1..v_n loop
    insert into public.trip_stops (trip_id, hub_id, stop_order, pickup_time)
    values (v_trip.id, v_hub_ids[i], i - 1, p_pickup_times[i]);
  end loop;
  return v_trip;
end; $$;

-- ======================= operator: conductor assignment =======================
create or replace function public.operator_assign_conductor(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_operator_member(v_uid, public.trip_operator(p_trip_id)) then raise exception 'FORBIDDEN'; end if;
  insert into public.trip_staff (trip_id, user_id, role) values (p_trip_id, p_user_id, 'conductor')
  on conflict (trip_id, user_id) do update set role = 'conductor';
end; $$;

create or replace function public.operator_remove_conductor(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_operator_member(v_uid, public.trip_operator(p_trip_id)) then raise exception 'FORBIDDEN'; end if;
  delete from public.trip_staff where trip_id = p_trip_id and user_id = p_user_id;
end; $$;

-- ======================= incidents =======================
create or replace function public._can_touch_incident_scope(
  v_uid uuid, p_trip_id uuid, p_hub_id uuid, p_operator_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_platform_admin(v_uid)
    or (p_operator_id is not null and public.is_operator_member(v_uid, p_operator_id))
    or (p_trip_id is not null and public.can_manage_trip(v_uid, p_trip_id))
    or (p_hub_id is not null and public.is_hub_staff(v_uid, p_hub_id));
$$;

create or replace function public.report_incident(
  p_kind incident_kind, p_trip_id uuid default null, p_hub_id uuid default null,
  p_booking_id uuid default null, p_staff_notes text default null, p_passenger_message text default null)
returns public.incidents
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_op uuid; v_row public.incidents;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_op := case when p_trip_id is not null then public.trip_operator(p_trip_id) else null end;
  if not public._can_touch_incident_scope(v_uid, p_trip_id, p_hub_id, v_op) then raise exception 'FORBIDDEN'; end if;
  insert into public.incidents (kind, trip_id, hub_id, booking_id, operator_id, reporter_id, status, staff_notes, passenger_message)
  values (p_kind, p_trip_id, p_hub_id, p_booking_id, v_op, v_uid, 'open', p_staff_notes, p_passenger_message)
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.update_incident(
  p_id uuid, p_status incident_status default null, p_staff_notes text default null, p_passenger_message text default null)
returns public.incidents
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.incidents;
begin
  select * into v_row from public.incidents where id = p_id;
  if not found then raise exception 'INCIDENT_NOT_FOUND'; end if;
  if v_uid is null or not public._can_touch_incident_scope(v_uid, v_row.trip_id, v_row.hub_id, v_row.operator_id) then
    raise exception 'FORBIDDEN';
  end if;
  update public.incidents set
    status = coalesce(p_status, status),
    staff_notes = coalesce(p_staff_notes, staff_notes),
    passenger_message = coalesce(p_passenger_message, passenger_message),
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end
  where id = p_id returning * into v_row;
  return v_row;
end; $$;

create or replace function public.resolve_incident(p_id uuid, p_resolution text)
returns public.incidents
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_row public.incidents;
begin
  select * into v_row from public.incidents where id = p_id;
  if not found then raise exception 'INCIDENT_NOT_FOUND'; end if;
  if v_uid is null or not public._can_touch_incident_scope(v_uid, v_row.trip_id, v_row.hub_id, v_row.operator_id) then
    raise exception 'FORBIDDEN';
  end if;
  update public.incidents set status = 'resolved', resolution = coalesce(nullif(trim(p_resolution),''),'Resolved'),
    resolved_at = now() where id = p_id returning * into v_row;
  return v_row;
end; $$;

-- ======================= completion: explicit unboarded handling =======================
-- Replaces 0009's update_trip_status so that completing a trip does NOT silently
-- turn un-boarded reservations into "completed". They become 'no_show', are flagged
-- unresolved, get an honest notification, and raise a single operations incident.
create or replace function public.update_trip_status(p_trip_id uuid, p_status trip_status)
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_t public.trips; r record; v_missed int := 0; v_op uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_t.status in ('completed','cancelled') then raise exception 'INVALID_STATE: trip already %', v_t.status; end if;
  if not (
    (v_t.status = 'scheduled' and p_status in ('boarding','en_route','completed'))
    or (v_t.status = 'boarding' and p_status in ('en_route','completed'))
    or (v_t.status = 'en_route' and p_status = 'completed')
    or (p_status = v_t.status)
  ) then
    raise exception 'INVALID_TRANSITION: % -> %', v_t.status, p_status;
  end if;

  if p_status = 'completed' then
    update public.trips set status = 'completed', progress = 1, last_update = now()
      where id = p_trip_id returning * into v_t;
    -- Boarded passengers travelled → completed.
    update public.bookings set status = 'completed', completed_at = now()
      where trip_id = p_trip_id and status = 'boarded';
    -- Reserved / checked-in but never boarded → no_show (NOT completed).
    for r in select id, passenger_id, seats, reference from public.bookings
             where trip_id = p_trip_id and status in ('reserved','checked_in') loop
      update public.bookings set status = 'no_show', unresolved = true where id = r.id;
      v_missed := v_missed + r.seats;
      perform public._log_event(r.id, p_trip_id, 'unresolved_pickup', v_uid,
        format('Trip completed without boarding — recorded as no-show (%s).', r.reference), '{}'::jsonb);
      perform public._notify(r.passenger_id, 'incident', 'You were not boarded',
        'Your reservation was not boarded before the trip completed, so you were not recorded as having travelled. Please contact the operator.',
        p_trip_id, r.id, 'no_show:' || r.id::text);
    end loop;
    if v_missed > 0 then
      v_op := public.trip_operator(p_trip_id);
      insert into public.incidents (kind, trip_id, operator_id, reporter_id, status, staff_notes, passenger_message)
      values ('left_unboarded', p_trip_id, v_op, v_uid, 'open',
        format('%s checked-in/reserved passenger seat(s) were not boarded at completion.', v_missed),
        'Some passengers were not boarded before the trip completed.');
    end if;
    perform public._log_event(null, p_trip_id, 'completed', v_uid, 'Trip completed.', '{}'::jsonb);
  else
    update public.trips set status = p_status, last_update = now() where id = p_trip_id returning * into v_t;
  end if;
  return v_t;
end; $$;

-- ======================= grants =======================
revoke execute on function public._can_touch_incident_scope(uuid, uuid, uuid, uuid) from public;
grant execute on function
  public.admin_create_operator(text, text),
  public.admin_update_operator(uuid, text, numeric, boolean),
  public.admin_create_hub(text, text, text, text, text, jsonb),
  public.admin_update_hub(uuid, text, text, text, text, text, jsonb, boolean),
  public.admin_set_hub_approval(uuid, hub_approval, text),
  public.admin_assign_operator_member(uuid, uuid, operator_role),
  public.admin_remove_operator_member(uuid, uuid),
  public.admin_assign_hub_staff(uuid, uuid),
  public.admin_remove_hub_staff(uuid, uuid),
  public.operator_create_vehicle(uuid, text, text, integer),
  public.operator_update_vehicle(uuid, text, text, integer),
  public.operator_create_route(uuid, direction, text, text),
  public.operator_set_route_stops(uuid, uuid[]),
  public.operator_create_departure(uuid, uuid, uuid, date, timestamptz, integer, integer, integer, timestamptz[]),
  public.operator_assign_conductor(uuid, uuid),
  public.operator_remove_conductor(uuid, uuid),
  public.report_incident(incident_kind, uuid, uuid, uuid, text, text),
  public.update_incident(uuid, incident_status, text, text),
  public.resolve_incident(uuid, text)
  to authenticated;
