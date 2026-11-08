-- 0022 Tell waiting passengers when their bus sets off.
--
-- When a trip first leaves 'scheduled' (the driver taps Start trip, the first hub
-- is marked reached, or operations start it), every passenger who is still to be
-- picked up gets one "Your bus is on its way" notification with their pickup hub
-- and expected time. The push function (supabase/functions/push) sends it to their
-- phone, and the pass opens on the live map. A trigger covers every path that
-- starts a trip, and the dedupe key makes it once per booking.
--
-- Not told: cancelled bookings, people already boarded, and passengers whose hub
-- the bus has already reached.

create or replace function public._notify_trip_started()
returns trigger
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare r record;
begin
  for r in
    select b.id, b.passenger_id, h.name as hub_name,
           s.pickup_time + make_interval(mins => new.delay_minutes) as expected
    from public.bookings b
    join public.trip_stops s on s.id = b.pickup_stop_id
    join public.hubs h on h.id = b.pickup_hub_id
    where b.trip_id = new.id
      and b.status in ('reserved', 'checked_in')
      and not s.reached
  loop
    perform public._notify(r.passenger_id, 'trip_started', 'Your bus is on its way',
      format('Pickup at %s around %s. Track the bus live in ToGo.',
             r.hub_name, to_char(r.expected at time zone 'Africa/Kampala', 'HH24:MI')),
      new.id, r.id, 'trip_started:' || r.id::text);
  end loop;
  return null;
end;
$$;

revoke execute on function public._notify_trip_started() from public;

drop trigger if exists trips_notify_started on public.trips;
create trigger trips_notify_started
  after update of status on public.trips
  for each row
  when (old.status = 'scheduled' and new.status in ('boarding', 'en_route'))
  execute function public._notify_trip_started();
