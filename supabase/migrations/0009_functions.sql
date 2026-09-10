-- 0009 Authoritative mutations as SECURITY DEFINER functions.
-- Every function: fixed search_path, checks auth.uid() and assignment explicitly,
-- validates state, and writes its audit event within the same transaction.

-- ---------------------------------------------------------------------------
-- Internal helpers (not granted to clients; called only by other functions).
-- ---------------------------------------------------------------------------
create or replace function public._gen_reference()
returns text language sql volatile as $$
  select 'TG-' || upper(substr(replace(encode(gen_random_bytes(4), 'hex'), '0',''), 1, 4)
    || substr(md5(gen_random_uuid()::text), 1, 2));
$$;

create or replace function public._log_event(
  p_booking uuid, p_trip uuid, p_kind booking_event_kind, p_actor uuid, p_message text, p_meta jsonb default '{}'::jsonb
) returns void
language sql volatile security definer set search_path = public, pg_temp as $$
  insert into public.booking_events (booking_id, trip_id, kind, actor_id, message, meta)
  values (p_booking, p_trip, p_kind, p_actor, coalesce(p_message,''), coalesce(p_meta,'{}'::jsonb));
$$;

create or replace function public._notify(
  p_user uuid, p_kind notification_kind, p_title text, p_body text,
  p_trip uuid, p_booking uuid, p_dedupe text
) returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (user_id, kind, title, body, trip_id, booking_id, dedupe_key)
  values (p_user, p_kind, p_title, coalesce(p_body,''), p_trip, p_booking, p_dedupe)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_booking — atomic, capacity-safe, idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_booking(
  p_trip_id uuid,
  p_pickup_stop_id uuid,
  p_dropoff_stop_id uuid,
  p_seats integer,
  p_passenger_name text,
  p_passenger_phone text default null,
  p_idempotency_key text default null
) returns public.bookings
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips;
  v_pickup public.trip_stops;
  v_dropoff public.trip_stops;
  v_reserved int;
  v_fingerprint text;
  v_existing public.bookings;
  v_booking public.bookings;
  v_ref text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: you must be signed in to reserve';
  end if;
  if p_seats is null or p_seats < 1 or p_seats > 10 then
    raise exception 'INVALID_SEATS: passenger count must be between 1 and 10';
  end if;

  v_fingerprint := md5(coalesce(p_trip_id::text,'') || '|' || coalesce(p_pickup_stop_id::text,'')
    || '|' || coalesce(p_dropoff_stop_id::text,'') || '|' || p_seats::text);

  -- Idempotency: replay returns the same booking; conflicting reuse fails.
  if p_idempotency_key is not null then
    select * into v_existing from public.bookings
      where passenger_id = v_uid and idempotency_key = p_idempotency_key;
    if found then
      if v_existing.request_fingerprint is distinct from v_fingerprint then
        raise exception 'IDEMPOTENCY_CONFLICT: key reused with different parameters';
      end if;
      return v_existing;
    end if;
  end if;

  -- Lock the trip row to serialise concurrent reservations for capacity.
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_trip.status not in ('scheduled', 'boarding') then
    raise exception 'TRIP_NOT_BOOKABLE: trip status is %', v_trip.status;
  end if;
  if now() > (v_trip.origin_departure - make_interval(mins => v_trip.booking_cutoff_minutes)) then
    raise exception 'BOOKING_CLOSED: reservations are closed for this departure';
  end if;

  select * into v_pickup from public.trip_stops where id = p_pickup_stop_id and trip_id = p_trip_id;
  if not found then raise exception 'INVALID_PICKUP_STOP'; end if;
  select * into v_dropoff from public.trip_stops where id = p_dropoff_stop_id and trip_id = p_trip_id;
  if not found then raise exception 'INVALID_DROPOFF_STOP'; end if;
  if not v_pickup.is_active or not v_dropoff.is_active then
    raise exception 'STOP_INACTIVE: a chosen stop is not active';
  end if;
  if v_pickup.stop_order >= v_dropoff.stop_order then
    raise exception 'STOP_ORDER: pickup must come before dropoff';
  end if;

  -- Whole-trip capacity: every active reservation consumes a seat for the whole trip.
  select coalesce(sum(seats), 0) into v_reserved from public.bookings
    where trip_id = p_trip_id and status in ('reserved','checked_in','boarded');
  if v_reserved + p_seats > v_trip.capacity then
    raise exception 'SOLD_OUT: only % seat(s) left', greatest(v_trip.capacity - v_reserved, 0);
  end if;

  v_ref := public._gen_reference();
  while exists (select 1 from public.bookings where reference = v_ref) loop
    v_ref := public._gen_reference();
  end loop;

  insert into public.bookings (
    trip_id, passenger_id, pickup_stop_id, dropoff_stop_id, pickup_hub_id, dropoff_hub_id,
    seats, status, payment_status, fare_ugx_snapshot, pickup_time_snapshot, dropoff_time_snapshot,
    reference, boarding_credential, idempotency_key, request_fingerprint, passenger_name, passenger_phone
  ) values (
    p_trip_id, v_uid, p_pickup_stop_id, p_dropoff_stop_id, v_pickup.hub_id, v_dropoff.hub_id,
    p_seats, 'reserved', 'pay_at_boarding', v_trip.fare_ugx,
    v_pickup.pickup_time + make_interval(mins => v_trip.delay_minutes),
    v_dropoff.pickup_time + make_interval(mins => v_trip.delay_minutes),
    v_ref, encode(gen_random_bytes(16), 'hex'), p_idempotency_key, v_fingerprint,
    coalesce(nullif(trim(p_passenger_name), ''), 'Traveller'), nullif(trim(p_passenger_phone), '')
  ) returning * into v_booking;

  perform public._log_event(v_booking.id, p_trip_id, 'reserved', v_uid,
    format('Reserved %s seat(s) (%s).', p_seats, v_ref),
    jsonb_build_object('seats', p_seats, 'reference', v_ref));
  perform public._notify(v_uid, 'booking_confirmed', 'Reservation confirmed',
    format('Your reservation %s is confirmed. Pay at boarding.', v_ref),
    p_trip_id, v_booking.id, 'booking_confirmed:' || v_booking.id::text);

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_booking — passenger (own) or staff; restores capacity by freeing the seat.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.bookings;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if not (v_b.passenger_id = v_uid
          or public.is_hub_staff(v_uid, v_b.pickup_hub_id)
          or public.can_manage_trip(v_uid, v_b.trip_id)
          or public.is_platform_admin(v_uid)) then
    raise exception 'FORBIDDEN: not allowed to cancel this booking';
  end if;

  if v_b.status = 'cancelled' then return v_b; end if; -- idempotent
  if v_b.status in ('boarded', 'completed') then
    raise exception 'INVALID_STATE: cannot cancel after boarding';
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id returning * into v_b;
  perform public._log_event(v_b.id, v_b.trip_id, 'cancelled', v_uid,
    format('Cancelled %s seat(s) (%s).', v_b.seats, v_b.reference), '{}'::jsonb);
  perform public._notify(v_b.passenger_id, 'trip_cancelled', 'Reservation cancelled',
    format('Reservation %s was cancelled and the seats released.', v_b.reference),
    v_b.trip_id, v_b.id, 'booking_cancelled:' || v_b.id::text);
  return v_b;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_booking — passenger self, or hub attendant at the pickup hub.
-- ---------------------------------------------------------------------------
create or replace function public.check_in_booking(p_booking_id uuid)
returns public.bookings
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.bookings;
  v_trip public.trips;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if not (v_b.passenger_id = v_uid
          or public.is_hub_staff(v_uid, v_b.pickup_hub_id)
          or public.can_manage_trip(v_uid, v_b.trip_id)
          or public.is_platform_admin(v_uid)) then
    raise exception 'FORBIDDEN: not allowed to check in this booking';
  end if;

  if v_b.status = 'checked_in' then return v_b; end if; -- idempotent
  if v_b.status <> 'reserved' then
    raise exception 'INVALID_STATE: booking is %', v_b.status;
  end if;
  select * into v_trip from public.trips where id = v_b.trip_id;
  if v_trip.status in ('completed', 'cancelled') then
    raise exception 'INVALID_STATE: trip is %', v_trip.status;
  end if;

  update public.bookings set status = 'checked_in', checked_in_at = now()
    where id = p_booking_id returning * into v_b;
  perform public._log_event(v_b.id, v_b.trip_id, 'checked_in', v_uid,
    format('Checked in at the hub (%s).', v_b.reference), '{}'::jsonb);
  perform public._notify(v_b.passenger_id, 'checked_in', 'Checked in',
    'You are checked in and waiting at the hub.', v_b.trip_id, v_b.id,
    'checked_in:' || v_b.id::text);
  return v_b;
end;
$$;

-- Attendant convenience: check in by reference at an assigned hub.
create or replace function public.check_in_by_reference(p_reference text)
returns public.bookings
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_b public.bookings;
begin
  select * into v_b from public.bookings where reference = upper(trim(p_reference));
  if not found then raise exception 'BOOKING_NOT_FOUND: no booking for that reference'; end if;
  return public.check_in_booking(v_b.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- board_booking — conductor validates an opaque credential for their trip.
-- ---------------------------------------------------------------------------
create or replace function public.board_booking(p_trip_id uuid, p_credential text)
returns public.bookings
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.bookings;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then
    raise exception 'FORBIDDEN: not assigned to this trip';
  end if;

  select * into v_b from public.bookings where boarding_credential = trim(p_credential) for update;
  if not found then raise exception 'INVALID_CODE: credential not recognised'; end if;
  if v_b.trip_id <> p_trip_id then raise exception 'WRONG_TRIP: credential belongs to another trip'; end if;
  if v_b.status = 'cancelled' then raise exception 'CANCELLED: this booking was cancelled'; end if;
  if v_b.status in ('boarded', 'completed') then raise exception 'ALREADY_BOARDED'; end if;

  update public.bookings set status = 'boarded', boarded_at = now()
    where id = v_b.id returning * into v_b;
  perform public._log_event(v_b.id, v_b.trip_id, 'boarded', v_uid,
    format('Boarded (%s, %s seat(s)).', v_b.reference, v_b.seats), '{}'::jsonb);
  perform public._notify(v_b.passenger_id, 'boarded', 'Boarded',
    'You have boarded. Safe travels!', v_b.trip_id, v_b.id, 'boarded:' || v_b.id::text);
  return v_b;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trip lifecycle: status changes, reach hub, cancel, unresolved pickups.
-- ---------------------------------------------------------------------------
create or replace function public.update_trip_status(p_trip_id uuid, p_status trip_status)
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_t public.trips;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_t.status in ('completed','cancelled') then
    raise exception 'INVALID_STATE: trip already %', v_t.status;
  end if;
  -- Allowed forward transitions.
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
    update public.bookings set status = 'completed', completed_at = now()
      where trip_id = p_trip_id and status = 'boarded';
    perform public._log_event(null, p_trip_id, 'completed', v_uid, 'Trip completed.', '{}'::jsonb);
  else
    update public.trips set status = p_status, last_update = now()
      where id = p_trip_id returning * into v_t;
  end if;
  return v_t;
end;
$$;

create or replace function public.report_delay(p_trip_id uuid, p_minutes integer)
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_t public.trips; r record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then raise exception 'FORBIDDEN'; end if;
  update public.trips set delay_minutes = greatest(0, delay_minutes + p_minutes), last_update = now()
    where id = p_trip_id and status not in ('completed','cancelled')
    returning * into v_t;
  if not found then raise exception 'INVALID_STATE: trip cannot be delayed'; end if;
  -- Notify active passengers of the delay (deduped per delay value).
  for r in select distinct passenger_id, id from public.bookings
           where trip_id = p_trip_id and status in ('reserved','checked_in') loop
    perform public._notify(r.passenger_id, 'delay', 'Trip delayed',
      format('Your trip is now delayed by %s minutes.', v_t.delay_minutes),
      p_trip_id, r.id, 'delay:' || r.id || ':' || v_t.delay_minutes::text);
  end loop;
  return v_t;
end;
$$;

create or replace function public.reach_hub(p_trip_id uuid, p_hub_id uuid)
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_t public.trips;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then raise exception 'FORBIDDEN'; end if;
  update public.trip_stops set reached = true where trip_id = p_trip_id and hub_id = p_hub_id;
  if not found then raise exception 'STOP_NOT_FOUND'; end if;
  update public.trips set status = case when status = 'scheduled' then 'en_route' else status end,
    last_update = now() where id = p_trip_id returning * into v_t;
  return v_t;
end;
$$;

create or replace function public.cancel_trip(p_trip_id uuid, p_reason text)
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_t public.trips; r record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_operator_member(v_uid, public.trip_operator(p_trip_id)) then
    raise exception 'FORBIDDEN: only operator staff/admin may cancel a trip';
  end if;
  select * into v_t from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;
  if v_t.status = 'completed' then raise exception 'INVALID_STATE: trip already completed'; end if;

  update public.trips set status = 'cancelled', cancel_reason = coalesce(nullif(trim(p_reason),''),'No reason provided'),
    last_update = now() where id = p_trip_id returning * into v_t;

  for r in select id, passenger_id, reference from public.bookings
           where trip_id = p_trip_id and status in ('reserved','checked_in','boarded') loop
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = r.id;
    perform public._log_event(r.id, p_trip_id, 'trip_cancelled', v_uid,
      format('Trip cancelled: %s', v_t.cancel_reason), '{}'::jsonb);
    perform public._notify(r.passenger_id, 'trip_cancelled', 'Trip cancelled',
      format('We are sorry — your trip was cancelled: %s. Your seats were released.', v_t.cancel_reason),
      p_trip_id, r.id, 'trip_cancelled:' || r.id::text);
  end loop;
  return v_t;
end;
$$;

create or replace function public.record_unresolved_pickup(p_trip_id uuid, p_hub_id uuid, p_reason text)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_seats int := 0; r record; v_op uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then raise exception 'FORBIDDEN'; end if;
  v_op := public.trip_operator(p_trip_id);
  for r in select id, passenger_id, seats, reference from public.bookings
           where trip_id = p_trip_id and pickup_hub_id = p_hub_id and status = 'checked_in' loop
    update public.bookings set unresolved = true where id = r.id;
    v_seats := v_seats + r.seats;
    perform public._log_event(r.id, p_trip_id, 'unresolved_pickup', v_uid,
      format('Left hub with checked-in passenger unboarded (%s).', r.reference), '{}'::jsonb);
    perform public._notify(r.passenger_id, 'incident', 'Pickup issue',
      'The bus left before you boarded. Please contact the hub attendant.', p_trip_id, r.id,
      'unresolved:' || r.id::text);
  end loop;
  insert into public.incidents (kind, trip_id, hub_id, operator_id, reporter_id, status, staff_notes, passenger_message)
  values ('left_unboarded', p_trip_id, p_hub_id, v_op, v_uid, 'open',
          coalesce(nullif(trim(p_reason),''),'No reason provided'),
          'Some checked-in passengers were not boarded before departure.');
  return v_seats;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operator schedule edit: capacity guard + schedule-change notifications.
-- ---------------------------------------------------------------------------
create or replace function public.operator_update_trip(
  p_trip_id uuid,
  p_fare_ugx integer default null,
  p_capacity integer default null,
  p_status trip_status default null,
  p_origin_departure timestamptz default null
) returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_t public.trips; v_active int; v_shift interval; r record; v_changed boolean := false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_operator_member(v_uid, public.trip_operator(p_trip_id)) then
    raise exception 'FORBIDDEN: only operator staff/admin may edit a trip';
  end if;
  select * into v_t from public.trips where id = p_trip_id for update;
  if not found then raise exception 'TRIP_NOT_FOUND'; end if;

  if p_capacity is not null then
    select coalesce(sum(seats),0) into v_active from public.bookings
      where trip_id = p_trip_id and status in ('reserved','checked_in','boarded');
    if p_capacity < v_active then
      raise exception 'CAPACITY_TOO_LOW: % active reserved seat(s) exist', v_active;
    end if;
  end if;
  if p_fare_ugx is not null and p_fare_ugx < 0 then raise exception 'INVALID_FARE'; end if;

  if p_origin_departure is not null and p_origin_departure <> v_t.origin_departure then
    v_shift := p_origin_departure - v_t.origin_departure;
    update public.trip_stops set pickup_time = pickup_time + v_shift where trip_id = p_trip_id;
    v_changed := true;
  end if;

  update public.trips set
    fare_ugx = coalesce(p_fare_ugx, fare_ugx),
    capacity = coalesce(p_capacity, capacity),
    status = coalesce(p_status, status),
    origin_departure = coalesce(p_origin_departure, origin_departure),
    destination_arrival = case when p_origin_departure is not null
                               then destination_arrival + v_shift else destination_arrival end,
    last_update = now()
  where id = p_trip_id returning * into v_t;

  if v_changed then
    for r in select id, passenger_id from public.bookings
             where trip_id = p_trip_id and status in ('reserved','checked_in') loop
      perform public._log_event(r.id, p_trip_id, 'schedule_changed', v_uid, 'Departure time changed.', '{}'::jsonb);
      perform public._notify(r.passenger_id, 'schedule_changed', 'Schedule updated',
        'Your trip departure time has changed. Please review your booking.',
        p_trip_id, r.id, 'schedule:' || r.id || ':' || extract(epoch from v_t.origin_departure)::bigint::text);
    end loop;
  end if;
  return v_t;
end;
$$;

-- Deactivate a stop only if no active bookings depend on it.
create or replace function public.deactivate_trip_stop(p_stop_id uuid)
returns public.trip_stops
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_s public.trip_stops; v_cnt int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_s from public.trip_stops where id = p_stop_id;
  if not found then raise exception 'STOP_NOT_FOUND'; end if;
  if not public.is_operator_member(v_uid, public.trip_operator(v_s.trip_id)) then
    raise exception 'FORBIDDEN';
  end if;
  select count(*) into v_cnt from public.bookings
    where (pickup_stop_id = p_stop_id or dropoff_stop_id = p_stop_id)
      and status in ('reserved','checked_in','boarded');
  if v_cnt > 0 then
    raise exception 'STOP_HAS_BOOKINGS: % active booking(s) use this stop', v_cnt;
  end if;
  update public.trip_stops set is_active = false where id = p_stop_id returning * into v_s;
  return v_s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Location reporting — trip staff only, throttled and validated.
-- ---------------------------------------------------------------------------
create or replace function public.report_location(
  p_trip_id uuid, p_lat numeric, p_lng numeric, p_accuracy numeric, p_observed_at timestamptz
) returns public.location_updates
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_last timestamptz; v_row public.location_updates; v_t public.trips;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.can_manage_trip(v_uid, p_trip_id) then
    raise exception 'FORBIDDEN: not assigned to this trip';
  end if;
  select * into v_t from public.trips where id = p_trip_id;
  if v_t.status in ('completed','cancelled') then
    raise exception 'INVALID_STATE: trip is not active';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDS';
  end if;
  if p_observed_at is null or p_observed_at > now() + interval '2 minutes'
     or p_observed_at < now() - interval '1 hour' then
    raise exception 'INVALID_OBSERVED_AT';
  end if;
  -- Throttle: at most one sample per reporter per trip every 5 seconds.
  select max(received_at) into v_last from public.location_updates
    where trip_id = p_trip_id and reporter_id = v_uid;
  if v_last is not null and now() - v_last < interval '5 seconds' then
    raise exception 'THROTTLED: too many updates, slow down';
  end if;
  insert into public.location_updates (trip_id, reporter_id, lat, lng, accuracy_m, observed_at)
  values (p_trip_id, v_uid, p_lat, p_lng, p_accuracy, p_observed_at)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language sql volatile security definer set search_path = public, pg_temp
as $$
  update public.notifications set read_at = now()
   where id = p_id and user_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Minimal-PII staff read functions (manifests). Explicit assignment checks.
-- ---------------------------------------------------------------------------
create or replace function public.get_trip_manifest(p_trip_id uuid)
returns table (
  booking_id uuid, reference text, passenger_name text, seats int,
  status booking_status, pickup_hub_id uuid, pickup_stop_order int, unresolved boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_trip(auth.uid(), p_trip_id) then raise exception 'FORBIDDEN'; end if;
  return query
    select b.id, b.reference, b.passenger_name, b.seats, b.status, b.pickup_hub_id,
           ts.stop_order, b.unresolved
    from public.bookings b
    join public.trip_stops ts on ts.id = b.pickup_stop_id
    where b.trip_id = p_trip_id and b.status <> 'cancelled'
    order by ts.stop_order, b.created_at;
end;
$$;

create or replace function public.get_hub_expected(p_hub_id uuid)
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
    where b.pickup_hub_id = p_hub_id and b.status in ('reserved','checked_in','boarded')
    order by b.pickup_time_snapshot;
end;
$$;
