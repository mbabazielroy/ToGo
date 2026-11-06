-- ==========================================================================
-- Check-in window (0018): check-in is refused until 2 hours before pickup.
-- ==========================================================================
reset role;
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d4','a0000000-0000-0000-0000-0000000000a1','KLA_MBR', current_date,
        now() + interval '5 hours', now() + interval '9 hours', 25000, 10, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('eb000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000d4','b0000000-0000-0000-0000-0000000000b1',0, now()+interval '5 hours'),
  ('eb000000-0000-0000-0000-0000000000a2','d0000000-0000-0000-0000-0000000000d4','b0000000-0000-0000-0000-0000000000b2',1, now()+interval '9 hours');
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select set_config('x.early', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d4','eb000000-0000-0000-0000-0000000000a1','eb000000-0000-0000-0000-0000000000a2',
  1,'Early',null,'idem-early')), false);
select tests.expect_error('checkin window: refused more than 2 hours before pickup',
  $$ select public.check_in_booking(current_setting('x.early')::uuid) $$);
reset role;
do $$ begin
  perform tests.check('checkin window: booking still reserved',
    (select status = 'reserved' from public.bookings where id = current_setting('x.early')::uuid));
end $$;

-- ==========================================================================
-- delete_my_account (0019) — a user can delete ONLY their own account; audit
-- rows that named them survive without the person; nobody else is touched.
-- ==========================================================================
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000099', 'leaver@test');
-- An audit row that names the leaver as the actor (no cascade on actor_id).
insert into public.booking_events (trip_id, kind, actor_id, message)
  select id, 'schedule_changed', '00000000-0000-0000-0000-000000000099', 'deletion test'
  from public.trips limit 1;

create temp table delete_test_others as
  select id from auth.users where id <> '00000000-0000-0000-0000-000000000099';

-- Signed out: refused.
select tests.login(null);
set role anon;
select tests.expect_error('delete account: anonymous caller rejected',
  $$ select public.delete_my_account() $$);
reset role;

-- Signed in as the leaver: deletes only their own account.
select tests.login('00000000-0000-0000-0000-000000000099');
set role authenticated;
select public.delete_my_account();
reset role;

do $$ begin
  perform tests.check('delete account: auth user removed',
    not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000099'));
  perform tests.check('delete account: profile removed by cascade',
    not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000099'));
  perform tests.check('delete account: audit row kept without the person',
    exists (select 1 from public.booking_events where message = 'deletion test' and actor_id is null));
  perform tests.check('delete account: other accounts untouched',
    not exists (select 1 from delete_test_others o where not exists (select 1 from auth.users u where u.id = o.id)));
end $$;
