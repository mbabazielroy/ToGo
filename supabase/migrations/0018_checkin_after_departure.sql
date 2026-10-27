-- 0018: close check-in once the bus has left the passenger's pickup hub.
--
-- Mirrors the shared app rule (src/state/logic.ts → checkIn). Replaces only
-- check_in_booking; its signature, SECURITY DEFINER settings and grants (0010) are
-- unchanged. check_in_by_reference calls this function, so it inherits the guard.

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
  -- Check-in closes once the bus has left the passenger's pickup hub.
  if exists (select 1 from public.trip_stops ts
             where ts.trip_id = v_b.trip_id and ts.hub_id = v_b.pickup_hub_id and ts.reached) then
    raise exception 'CHECKIN_CLOSED: the bus has already left this hub';
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
