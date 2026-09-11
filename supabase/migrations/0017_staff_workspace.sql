-- 0017 Staff-workspace resolution for the native/connected staff app.
--
-- Fills the previously-stubbed adapter surface (listStaff / staffTrips /
-- attendantHubId / hubIncidents / resolveBoarding) and adds driver crew
-- assignment (conductor assignment already existed in 0013). Every function is
-- SECURITY DEFINER with a fixed search_path and an explicit authority check on the
-- caller's JWT identity — preview personas are NEVER involved here.
--
-- Reconciliation note: the fare snapshot (bookings.fare_ugx_snapshot, set in
-- reserve_booking) and conductor assignment (operator_assign_conductor) already
-- exist; this migration does NOT re-add them. It adds only genuine gaps.

-- ---------------------------------------------------------------------------
-- resolve_boarding — READ-ONLY sibling of board_booking. Same validation and
-- authority, but it never mutates: it tells the UI which booking a credential
-- would board so a conductor can confirm first. Boarding still happens only via
-- board_booking. STABLE guarantees it performs no writes.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_boarding(p_trip_id uuid, p_credential text)
returns public.bookings
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.bookings;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then
    raise exception 'FORBIDDEN: not assigned to this trip';
  end if;
  select * into v_b from public.bookings where boarding_credential = trim(p_credential);
  if not found then raise exception 'INVALID_CODE: credential not recognised'; end if;
  if v_b.trip_id <> p_trip_id then raise exception 'WRONG_TRIP: credential belongs to another trip'; end if;
  if v_b.status = 'cancelled' then raise exception 'CANCELLED: this booking was cancelled'; end if;
  if v_b.status in ('boarded', 'completed') then raise exception 'ALREADY_BOARDED'; end if;
  return v_b; -- no status change
end;
$$;

-- ---------------------------------------------------------------------------
-- my_staff_workspaces — the CALLER's own verified staff roles. This is not a
-- directory of other staff: it returns only workspaces the authenticated user is
-- actually assigned to (trip_staff for driver/conductor, hub_staff for attendant).
-- ---------------------------------------------------------------------------
create or replace function public.my_staff_workspaces()
returns table (
  role text, operator_id uuid, operator_name text,
  hub_id uuid, hub_name text, assigned_trip_count int, staff_name text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select full_name into v_name from public.profiles where id = v_uid;
  return query
    -- Driver / conductor workspaces, one aggregated row per role held.
    select ts.role::text,
           (array_agg(t.operator_id order by t.origin_departure))[1],
           (array_agg(o.name order by t.origin_departure))[1],
           null::uuid, null::text,
           count(*)::int,
           coalesce(v_name, 'Staff')
    from public.trip_staff ts
    join public.trips t on t.id = ts.trip_id
    join public.operators o on o.id = t.operator_id
    where ts.user_id = v_uid
    group by ts.role
    union all
    -- One attendant workspace per staffed hub.
    select 'attendant', null::uuid, null::text, h.id, h.name, 0, coalesce(v_name, 'Staff')
    from public.hub_staff hs
    join public.hubs h on h.id = hs.hub_id
    where hs.user_id = v_uid;
end;
$$;

-- Trip ids the caller is assigned to in a given crew role (driver | conductor).
create or replace function public.my_assigned_trip_ids(p_role trip_staff_role)
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select ts.trip_id from public.trip_staff ts
  where ts.user_id = auth.uid() and ts.role = p_role;
$$;

-- ---------------------------------------------------------------------------
-- get_hub_incidents — bookings at an attendant's hub that need follow-up:
-- flagged unresolved, or classified missed_pickup (or legacy no_show). Mirrors
-- get_hub_expected's shape and its is_hub_staff authority check.
-- ---------------------------------------------------------------------------
create or replace function public.get_hub_incidents(p_hub_id uuid)
returns table (
  booking_id uuid, reference text, passenger_name text, seats int,
  status booking_status, trip_id uuid, pickup_time timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_hub_staff(auth.uid(), p_hub_id) then raise exception 'FORBIDDEN'; end if;
  return query
    select b.id, b.reference, b.passenger_name, b.seats, b.status, b.trip_id, b.pickup_time_snapshot
    from public.bookings b
    where b.pickup_hub_id = p_hub_id
      and (b.unresolved = true or b.status in ('missed_pickup', 'no_show'))
    order by b.pickup_time_snapshot;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver crew assignment (conductor assignment already exists in 0013). Only the
-- trip's operator staff/admin may assign; role is fixed to 'driver'.
-- ---------------------------------------------------------------------------
create or replace function public.operator_assign_driver(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_operator_member(v_uid, public.trip_operator(p_trip_id)) then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.trip_staff (trip_id, user_id, role) values (p_trip_id, p_user_id, 'driver')
  on conflict (trip_id, user_id) do update set role = 'driver';
end; $$;

create or replace function public.operator_remove_driver(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_operator_member(v_uid, public.trip_operator(p_trip_id)) then
    raise exception 'FORBIDDEN';
  end if;
  delete from public.trip_staff where trip_id = p_trip_id and user_id = p_user_id and role = 'driver';
end; $$;

-- ======================= grants =======================
grant execute on function
  public.resolve_boarding(uuid, text),
  public.my_staff_workspaces(),
  public.my_assigned_trip_ids(trip_staff_role),
  public.get_hub_incidents(uuid),
  public.operator_assign_driver(uuid, uuid),
  public.operator_remove_driver(uuid, uuid)
  to authenticated;
