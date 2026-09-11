-- Phase-4 cases: read-only boarding resolution, driver crew assignment, hub-incident
-- reads, and self-only staff-workspace resolution. Runs after rls_cases2.sql in the
-- same session (fixtures + helpers already loaded). Fresh ids to avoid clashes.
\set ON_ERROR_STOP on
set client_min_messages = warning;

\set conductor '00000000-0000-0000-0000-000000000004'
\set attendant '00000000-0000-0000-0000-000000000005'
\set opstaff   '00000000-0000-0000-0000-000000000003'
\set rival     '00000000-0000-0000-0000-000000000007'
\set pA        '00000000-0000-0000-0000-000000000001'
\set pB        '00000000-0000-0000-0000-000000000002'
\set nobody    '00000000-0000-0000-0000-00000000000a'

-- Fresh bookable trip d3 under Savannah (a1); conductor 004 assigned, driverless.
reset role;
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d3','a0000000-0000-0000-0000-0000000000a1','KLA_MBR', current_date,
        now() + interval '5 hours', now() + interval '9 hours', 25000, 10, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('ea000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000d3','b0000000-0000-0000-0000-0000000000b1',0, now()+interval '5 hours'),
  ('ea000000-0000-0000-0000-0000000000a2','d0000000-0000-0000-0000-0000000000d3','b0000000-0000-0000-0000-0000000000b2',1, now()+interval '9 hours');
insert into public.trip_staff (trip_id, user_id, role) values ('d0000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-000000000004','conductor');

-- pA reserves on d3 and we capture the opaque credential (passenger can read own row).
select tests.login(:'pA');
set role authenticated;
select set_config('x.bk3', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d3','ea000000-0000-0000-0000-0000000000a1','ea000000-0000-0000-0000-0000000000a2',
  1,'ResolveMe',null,'idem-r3')), false);
select set_config('x.cred3', (select boarding_credential from public.bookings where id = current_setting('x.bk3')::uuid), false);
reset role;

-- ==========================================================================
-- resolve_boarding — read-only: validates + returns, never boards.
-- ==========================================================================
select tests.login(:'conductor');
set role authenticated;
do $$ begin
  perform tests.check('resolve: returns the matching booking',
    (public.resolve_boarding('d0000000-0000-0000-0000-0000000000d3', current_setting('x.cred3'))).reference is not null);
  perform tests.check('resolve: does NOT board (status still reserved)',
    (select status = 'reserved' from public.get_trip_manifest('d0000000-0000-0000-0000-0000000000d3')
      where booking_id = current_setting('x.bk3')::uuid));
end $$;
select tests.expect_error('resolve: wrong-trip credential rejected',
  $$ select public.resolve_boarding('d0000000-0000-0000-0000-0000000000d2', current_setting('x.cred3')) $$);
select tests.expect_error('resolve: unknown credential rejected',
  $$ select public.resolve_boarding('d0000000-0000-0000-0000-0000000000d3', 'deadbeef') $$);
reset role;

-- A non-crew user cannot resolve on this trip.
select tests.login(:'pB');
set role authenticated;
select tests.expect_error('resolve: non-staff cannot resolve',
  $$ select public.resolve_boarding('d0000000-0000-0000-0000-0000000000d3', current_setting('x.cred3')) $$);
reset role;

-- After boarding for real, resolve reports ALREADY_BOARDED.
select tests.login(:'conductor');
set role authenticated;
do $$ begin perform public.board_booking('d0000000-0000-0000-0000-0000000000d3', current_setting('x.cred3')); end $$;
select tests.expect_error('resolve: already-boarded rejected',
  $$ select public.resolve_boarding('d0000000-0000-0000-0000-0000000000d3', current_setting('x.cred3')) $$);
reset role;

-- ==========================================================================
-- Driver crew assignment (operator-scoped).
-- ==========================================================================
select tests.login(:'opstaff');
set role authenticated;
do $$ begin
  perform public.operator_assign_driver('d0000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000a');
  perform tests.check('driver: assignment stored with driver role',
    (select role = 'driver' from public.trip_staff
      where trip_id = 'd0000000-0000-0000-0000-0000000000d3' and user_id = '00000000-0000-0000-0000-00000000000a'));
end $$;
reset role;
-- A different operator cannot assign crew on this trip.
select tests.login(:'rival');
set role authenticated;
select tests.expect_error('driver: cross-operator assignment rejected',
  $$ select public.operator_assign_driver('d0000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000a') $$);
reset role;
-- The assigned driver can now manage the trip (read its manifest).
select tests.login(:'nobody');
set role authenticated;
do $$ begin
  perform tests.check('driver: assigned driver can read the trip manifest',
    (select count(*) >= 1 from public.get_trip_manifest('d0000000-0000-0000-0000-0000000000d3')));
end $$;
reset role;
-- Removal clears the assignment.
select tests.login(:'opstaff');
set role authenticated;
do $$ begin
  perform public.operator_remove_driver('d0000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000a');
  perform tests.check('driver: removal clears the assignment',
    (select count(*) = 0 from public.trip_staff
      where trip_id = 'd0000000-0000-0000-0000-0000000000d3' and user_id = '00000000-0000-0000-0000-00000000000a'));
end $$;
reset role;

-- ==========================================================================
-- get_hub_incidents — attendant-only; surfaces flagged bookings at the hub.
-- (d9 from rls_cases2 completed with pA checked-in-but-unboarded at hub b1 →
--  missed_pickup + unresolved.)
-- ==========================================================================
select tests.login(:'attendant');
set role authenticated;
do $$ begin
  perform tests.check('hub incidents: attendant sees a flagged booking at their hub',
    (select count(*) >= 1 from public.get_hub_incidents('b0000000-0000-0000-0000-0000000000b1')));
end $$;
reset role;
select tests.login(:'pB');
set role authenticated;
select tests.expect_error('hub incidents: non-staff rejected',
  $$ select * from public.get_hub_incidents('b0000000-0000-0000-0000-0000000000b1') $$);
reset role;

-- ==========================================================================
-- my_staff_workspaces — returns ONLY the caller's own verified assignments.
-- ==========================================================================
select tests.login(:'conductor');
set role authenticated;
do $$ begin
  perform tests.check('workspaces: conductor sees a conductor workspace',
    (select count(*) >= 1 from public.my_staff_workspaces() where role = 'conductor'));
end $$;
reset role;
select tests.login(:'attendant');
set role authenticated;
do $$ begin
  perform tests.check('workspaces: attendant sees their assigned hub',
    (select count(*) = 1 from public.my_staff_workspaces()
      where role = 'attendant' and hub_id = 'b0000000-0000-0000-0000-0000000000b1'));
end $$;
reset role;
select tests.login(:'pA');
set role authenticated;
do $$ begin
  perform tests.check('workspaces: a passenger has no staff workspaces',
    (select count(*) = 0 from public.my_staff_workspaces()));
end $$;
reset role;
