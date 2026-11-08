-- ==========================================================================
-- "Your bus is on its way" (0022): when a trip first sets off, each passenger
-- still to be picked up is told once; cancelled bookings and passengers whose
-- hub the bus has already passed are not.
-- ==========================================================================
reset role;
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d6', 'a0000000-0000-0000-0000-0000000000a1', 'KLA_MBR', current_date,
        now() + interval '60 minutes', now() + interval '300 minutes', 25000, 10, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('e0000000-0000-0000-0000-0000000006a1', 'd0000000-0000-0000-0000-0000000000d6', 'b0000000-0000-0000-0000-0000000000b1', 0, now() + interval '60 minutes'),
  ('e0000000-0000-0000-0000-0000000006a2', 'd0000000-0000-0000-0000-0000000000d6', 'b0000000-0000-0000-0000-0000000000b2', 1, now() + interval '300 minutes');

-- Passenger A reserves; passenger B reserves and cancels.
select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('x.startA', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d6', 'e0000000-0000-0000-0000-0000000006a1', 'e0000000-0000-0000-0000-0000000006a2',
  1, 'Amina', null, 'idem-start-A')), false);
reset role;
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('x.startB', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d6', 'e0000000-0000-0000-0000-0000000006a1', 'e0000000-0000-0000-0000-0000000006a2',
  1, 'Brian', null, 'idem-start-B')), false);
select public.cancel_booking(current_setting('x.startB')::uuid);
reset role;

-- Moving a scheduled trip's details doesn't count as setting off.
update public.trips set delay_minutes = 10 where id = 'd0000000-0000-0000-0000-0000000000d6';
do $$ begin
  perform tests.check('started: no alert before the trip starts',
    not exists (select 1 from public.notifications where kind = 'trip_started' and trip_id = 'd0000000-0000-0000-0000-0000000000d6'));
end $$;

-- The bus sets off.
update public.trips set status = 'en_route' where id = 'd0000000-0000-0000-0000-0000000000d6';
do $$ begin
  perform tests.check('started: waiting passenger told once',
    (select count(*) = 1 from public.notifications
     where kind = 'trip_started' and booking_id = current_setting('x.startA')::uuid
       and user_id = '00000000-0000-0000-0000-000000000001'));
  perform tests.check('started: message names the pickup hub',
    (select body like 'Pickup at Nakawa Green Hub around %' from public.notifications
     where kind = 'trip_started' and booking_id = current_setting('x.startA')::uuid));
  perform tests.check('started: cancelled booking not told',
    not exists (select 1 from public.notifications where kind = 'trip_started' and booking_id = current_setting('x.startB')::uuid));
end $$;

-- Started again after a correction: still one alert.
update public.trips set status = 'scheduled' where id = 'd0000000-0000-0000-0000-0000000000d6';
update public.trips set status = 'boarding' where id = 'd0000000-0000-0000-0000-0000000000d6';
do $$ begin
  perform tests.check('started: not repeated',
    (select count(*) = 1 from public.notifications where kind = 'trip_started' and booking_id = current_setting('x.startA')::uuid));
end $$;

-- Another trip started by reaching its first hub: passengers at that hub aren't told.
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d7', 'a0000000-0000-0000-0000-0000000000a1', 'KLA_MBR', current_date,
        now() + interval '60 minutes', now() + interval '300 minutes', 25000, 10, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('e0000000-0000-0000-0000-0000000007a1', 'd0000000-0000-0000-0000-0000000000d7', 'b0000000-0000-0000-0000-0000000000b1', 0, now() + interval '60 minutes'),
  ('e0000000-0000-0000-0000-0000000007a2', 'd0000000-0000-0000-0000-0000000000d7', 'b0000000-0000-0000-0000-0000000000b2', 1, now() + interval '300 minutes');
select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('x.startC', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d7', 'e0000000-0000-0000-0000-0000000007a1', 'e0000000-0000-0000-0000-0000000007a2',
  1, 'Amina', null, 'idem-start-C')), false);
reset role;
update public.trip_stops set reached = true where id = 'e0000000-0000-0000-0000-0000000007a1';
update public.trips set status = 'en_route' where id = 'd0000000-0000-0000-0000-0000000000d7';
do $$ begin
  perform tests.check('started: passenger whose hub was already reached not told',
    not exists (select 1 from public.notifications where kind = 'trip_started' and booking_id = current_setting('x.startC')::uuid));
end $$;
