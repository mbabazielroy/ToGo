-- 0016 Correct passenger outcome classification at trip completion.
--
-- Boarded            → completed (travelled).
-- Checked-in, unboarded → missed_pickup + unresolved; raises a per-hub
--   'missed_pickup' incident for operational investigation; neutral passenger note.
-- Reserved, never checked in → not_boarded; NEUTRAL note; NO incident, NOT flagged
--   unresolved (no fault assigned without an attendance policy).
-- Cancelled          → untouched (stays cancelled).
--
-- Attendance timestamps (checked_in_at/boarded_at) are preserved; only status and
-- the unresolved flag change. Audit events are written in the same transaction.
create or replace function public.update_trip_status(p_trip_id uuid, p_status trip_status)
returns public.trips
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_t public.trips; r record;
  v_missed_seats int := 0; v_notboarded_seats int := 0; v_op uuid; v_hub record;
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

  if p_status <> 'completed' then
    update public.trips set status = p_status, last_update = now() where id = p_trip_id returning * into v_t;
    return v_t;
  end if;

  -- ---- completion ----
  update public.trips set status = 'completed', progress = 1, last_update = now()
    where id = p_trip_id returning * into v_t;
  v_op := public.trip_operator(p_trip_id);

  -- Boarded → completed (journey travelled).
  update public.bookings set status = 'completed', completed_at = now()
    where trip_id = p_trip_id and status = 'boarded';

  -- Checked-in but unboarded → missed_pickup (operational investigation).
  for r in select id, passenger_id, seats, reference from public.bookings
           where trip_id = p_trip_id and status = 'checked_in' loop
    update public.bookings set status = 'missed_pickup', unresolved = true where id = r.id;
    v_missed_seats := v_missed_seats + r.seats;
    perform public._log_event(r.id, p_trip_id, 'unresolved_pickup', v_uid,
      format('Checked in but not boarded before completion — missed pickup (%s).', r.reference), '{}'::jsonb);
    perform public._notify(r.passenger_id, 'incident', 'We are looking into your pickup',
      'You checked in but were not boarded before the trip completed. Our operations team is investigating and will follow up.',
      p_trip_id, r.id, 'missed_pickup:' || r.id::text);
  end loop;

  -- Reserved, never checked in → not_boarded (neutral; no fault, no incident).
  for r in select id, passenger_id, seats, reference from public.bookings
           where trip_id = p_trip_id and status = 'reserved' loop
    update public.bookings set status = 'not_boarded' where id = r.id;
    v_notboarded_seats := v_notboarded_seats + r.seats;
    perform public._log_event(r.id, p_trip_id, 'unresolved_pickup', v_uid,
      format('Reserved but not checked in or boarded — not boarded (%s).', r.reference), '{}'::jsonb);
    perform public._notify(r.passenger_id, 'trip_cancelled', 'You were not boarded',
      'This trip has completed and you were not boarded, so you were not recorded as having travelled.',
      p_trip_id, r.id, 'not_boarded:' || r.id::text);
  end loop;

  -- One missed-pickup incident per affected hub, for operations to investigate.
  if v_missed_seats > 0 then
    for v_hub in select pickup_hub_id, sum(seats) as seats from public.bookings
                 where trip_id = p_trip_id and status = 'missed_pickup' group by pickup_hub_id loop
      insert into public.incidents (kind, trip_id, hub_id, operator_id, reporter_id, status, staff_notes, passenger_message)
      values ('missed_pickup', p_trip_id, v_hub.pickup_hub_id, v_op, v_uid, 'open',
        format('%s checked-in passenger seat(s) not boarded at this hub before completion. Investigate.', v_hub.seats),
        'Some checked-in passengers were not boarded before the trip completed.');
    end loop;
  end if;

  perform public._log_event(null, p_trip_id, 'completed', v_uid,
    format('Trip completed. %s missed-pickup seat(s), %s not-boarded seat(s).', v_missed_seats, v_notboarded_seats),
    jsonb_build_object('missed', v_missed_seats, 'not_boarded', v_notboarded_seats));
  return v_t;
end; $$;
