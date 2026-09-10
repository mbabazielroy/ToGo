-- Test cases. Assumes rls_test.sql (fixtures + helpers) already ran in this session.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- IDs used throughout
\set pA '00000000-0000-0000-0000-000000000001'
\set pB '00000000-0000-0000-0000-000000000002'
\set opstaff '00000000-0000-0000-0000-000000000003'
\set conductor '00000000-0000-0000-0000-000000000004'
\set attendant '00000000-0000-0000-0000-000000000005'
\set admin '00000000-0000-0000-0000-000000000006'
\set rival '00000000-0000-0000-0000-000000000007'
\set trip1 'd0000000-0000-0000-0000-0000000000d1'
\set trip2 'd0000000-0000-0000-0000-0000000000d2'
\set pickup1 'e0000000-0000-0000-0000-0000000000e1'
\set dropoff1 'e0000000-0000-0000-0000-0000000000e2'
\set hub1 'b0000000-0000-0000-0000-0000000000b1'

-- ==========================================================================
-- 1. Passenger A reserves 2 of 4 seats (happy path + snapshot).
-- ==========================================================================
select tests.login(:'pA');
set role authenticated;
select set_config('x.bkA', (select id::text from public.reserve_booking(
  :'trip1', :'pickup1', :'dropoff1', 2, 'Amina', '+256700000001', 'idem-A-1')), false);
do $$ begin
  perform tests.check('reserve: booking created',
    (select count(*) = 1 from public.bookings where idempotency_key = 'idem-A-1'));
  perform tests.check('reserve: fare snapshot = 25000',
    (select fare_ugx_snapshot = 25000 from public.bookings where idempotency_key = 'idem-A-1'));
  perform tests.check('reserve: seats_available now 2',
    (select seats_available = 2 from public.trips_public where id = 'd0000000-0000-0000-0000-0000000000d1'));
  perform tests.check('reserve: booking_confirmed notification exists',
    (select count(*) >= 1 from public.notifications where kind = 'booking_confirmed'));
end $$;
-- Capture the opaque credential now, while the owning passenger can read it.
select set_config('x.credA',
  (select boarding_credential from public.bookings where idempotency_key = 'idem-A-1'), false);

-- Idempotent replay returns same booking; conflicting reuse fails.
do $$
declare v1 uuid; v2 uuid;
begin
  v1 := (select id from public.bookings where idempotency_key = 'idem-A-1');
  v2 := (select id from public.reserve_booking('d0000000-0000-0000-0000-0000000000d1',
          'e0000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-0000000000e2',2,'Amina',null,'idem-A-1'));
  perform tests.check('idempotency: replay returns same booking', v1 = v2);
end $$;
select tests.expect_error('idempotency: conflicting reuse fails',
  $$ select public.reserve_booking('d0000000-0000-0000-0000-0000000000d1',
       'e0000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-0000000000e2',3,'Amina',null,'idem-A-1') $$);

-- ==========================================================================
-- 2. Overbooking: A holds 2, B tries 3 (only 2 left) -> fail; B takes 2 -> ok; next fails.
-- ==========================================================================
reset role;
select tests.login(:'pB');
set role authenticated;
select tests.expect_error('overbook: 3 seats when 2 left fails',
  $$ select public.reserve_booking('d0000000-0000-0000-0000-0000000000d1',
       'e0000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-0000000000e2',3,'Bob',null,'idem-B-1') $$);
select set_config('x.bkB', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d1','e0000000-0000-0000-0000-0000000000e1',
  'e0000000-0000-0000-0000-0000000000e2',2,'Bob',null,'idem-B-2')), false);
do $$ begin
  perform tests.check('capacity: trip now full (0 available)',
    (select seats_available = 0 from public.trips_public where id = 'd0000000-0000-0000-0000-0000000000d1'));
end $$;
select tests.expect_error('overbook: reserving into a full trip fails',
  $$ select public.reserve_booking('d0000000-0000-0000-0000-0000000000d1',
       'e0000000-0000-0000-0000-0000000000e1','e0000000-0000-0000-0000-0000000000e2',1,'Bob',null,'idem-B-3') $$);

-- ==========================================================================
-- 3. Cancellation restores capacity exactly once (idempotent).
-- ==========================================================================
do $$
declare bkB uuid := current_setting('x.bkB')::uuid;
begin
  perform public.cancel_booking(bkB);
  perform tests.check('cancel: capacity restored to 2',
    (select seats_available = 2 from public.trips_public where id = 'd0000000-0000-0000-0000-0000000000d1'));
  -- second cancel is a no-op; capacity must not jump.
  perform public.cancel_booking(bkB);
  perform tests.check('cancel: idempotent (still 2 available)',
    (select seats_available = 2 from public.trips_public where id = 'd0000000-0000-0000-0000-0000000000d1'));
end $$;

-- ==========================================================================
-- 4. Passenger cannot read another passenger's booking (RLS).
-- ==========================================================================
do $$
declare bkA uuid := current_setting('x.bkA')::uuid;  -- still visible? current role is pB
begin
  perform tests.check('rls: passenger B cannot see A booking',
    (select count(*) = 0 from public.bookings where id = bkA));
end $$;
reset role;
select tests.login(:'pA');
set role authenticated;
do $$
declare bkA uuid := current_setting('x.bkA')::uuid;
begin
  perform tests.check('rls: passenger A can see own booking',
    (select count(*) = 1 from public.bookings where id = bkA));
end $$;

-- ==========================================================================
-- 5. Internal hub data hidden; only bookable hubs in public view.
-- ==========================================================================
do $$ begin
  perform tests.check('hubs_public: pending hub excluded',
    (select count(*) = 0 from public.hubs_public where id = 'b0000000-0000-0000-0000-0000000000b3'));
  perform tests.check('hubs_public: approved hub present',
    (select count(*) = 1 from public.hubs_public where id = 'b0000000-0000-0000-0000-0000000000b1'));
  -- Passenger has no direct row access to the hubs base table (staff-only).
  perform tests.check('rls: passenger cannot read hubs base table',
    (select count(*) = 0 from public.hubs));
end $$;

-- ==========================================================================
-- 6. Check-in guards + attendant scope.
-- ==========================================================================
-- Passenger A checks in (self).
do $$
declare bkA uuid := current_setting('x.bkA')::uuid;
begin
  perform public.check_in_booking(bkA);
  perform tests.check('checkin: status now checked_in',
    (select status = 'checked_in' from public.bookings where id = bkA));
end $$;

-- Attendant at hub1 can see expected passengers via RPC and check in by reference.
reset role;
select tests.login(:'attendant');
set role authenticated;
do $$ begin
  perform tests.check('attendant: manifest RPC returns rows',
    (select count(*) >= 1 from public.get_hub_expected('b0000000-0000-0000-0000-0000000000b1')));
end $$;
-- Attendant for a hub they are NOT assigned to is rejected.
select tests.expect_error('attendant: cannot read a hub they are not assigned',
  $$ select * from public.get_hub_expected('b0000000-0000-0000-0000-0000000000b2') $$);

-- ==========================================================================
-- 7. Boarding: conductor validates credential; wrong trip & double-board fail.
-- ==========================================================================
reset role;
select tests.login(:'conductor');
set role authenticated;
do $$
declare bkA uuid := current_setting('x.bkA')::uuid; cred text;
begin
  -- Conductor can read the credential? No — bookings base is passenger/admin only.
  -- The credential is fetched here from superuser context via GUC set earlier is not available;
  -- instead simulate the QR scan value captured at reserve time.
  cred := current_setting('x.credA');
  perform public.board_booking('d0000000-0000-0000-0000-0000000000d1', cred);
  -- Verify via the staff manifest RPC (conductors have no direct booking-row access).
  perform tests.check('board: status now boarded',
    (select status = 'boarded' from public.get_trip_manifest('d0000000-0000-0000-0000-0000000000d1')
       where booking_id = bkA));
end $$;
-- Double board fails.
select tests.expect_error('board: double board rejected',
  $$ select public.board_booking('d0000000-0000-0000-0000-0000000000d1', current_setting('x.credA')) $$);
-- Wrong-trip credential (valid cred but wrong trip id) fails.
select tests.expect_error('board: wrong-trip credential rejected',
  $$ select public.board_booking('d0000000-0000-0000-0000-0000000000d2', current_setting('x.credA')) $$);
-- Unknown credential fails.
select tests.expect_error('board: unknown credential rejected',
  $$ select public.board_booking('d0000000-0000-0000-0000-0000000000d1', 'deadbeef') $$);

-- ==========================================================================
-- 8. Cross-operator / cross-trip staff access denied.
-- ==========================================================================
-- Rival operator staff cannot manage trip1 (owned by Savannah).
reset role;
select tests.login(:'rival');
set role authenticated;
select tests.expect_error('cross-operator: rival cannot update trip1 status',
  $$ select public.update_trip_status('d0000000-0000-0000-0000-0000000000d1', 'boarding') $$);
select tests.expect_error('cross-operator: rival cannot read trip1 manifest',
  $$ select * from public.get_trip_manifest('d0000000-0000-0000-0000-0000000000d1') $$);
-- Rival cannot see Savannah trip rows in base table.
do $$ begin
  perform tests.check('cross-operator: rival cannot see trip1 base row',
    (select count(*) = 0 from public.trips where id = 'd0000000-0000-0000-0000-0000000000d1'));
end $$;

-- ==========================================================================
-- 9. Unauthorized privilege escalation blocked.
-- ==========================================================================
select tests.expect_error('escalation: cannot self-promote to admin',
  $$ update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000007' $$);
select tests.expect_error('escalation: cannot self-insert operator membership',
  $$ insert into public.operator_members(operator_id, user_id, role)
     values ('a0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000007','staff') $$);
select tests.expect_error('escalation: cannot assign staff on another operators trip',
  $$ insert into public.trip_staff(trip_id, user_id, role)
     values ('d0000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000007','conductor') $$);

-- ==========================================================================
-- 10. Unauthorized location writes blocked; assigned conductor allowed.
-- ==========================================================================
select tests.expect_error('location: rival cannot report on trip1',
  $$ select public.report_location('d0000000-0000-0000-0000-0000000000d1', 0.3, 32.5, 10, now()) $$);
reset role;
select tests.login(:'conductor');
set role authenticated;
do $$ begin
  perform public.report_location('d0000000-0000-0000-0000-0000000000d1', 0.3476, 32.5825, 12.0, now());
  perform tests.check('location: assigned conductor can report',
    (select count(*) = 1 from public.location_updates where trip_id = 'd0000000-0000-0000-0000-0000000000d1'));
end $$;
select tests.expect_error('location: throttled on rapid second write',
  $$ select public.report_location('d0000000-0000-0000-0000-0000000000d1', 0.3477, 32.5826, 12.0, now()) $$);
select tests.expect_error('location: invalid coordinates rejected',
  $$ select public.report_location('d0000000-0000-0000-0000-0000000000d1', 999, 32.5, 10, now()) $$);

-- ==========================================================================
-- 11. Invalid trip transition rejected.
-- ==========================================================================
reset role;
select tests.login(:'opstaff');
set role authenticated;
-- completed is terminal; cannot go back to scheduled.
do $$ begin perform public.update_trip_status('d0000000-0000-0000-0000-0000000000d1','en_route'); end $$;
do $$ begin perform public.update_trip_status('d0000000-0000-0000-0000-0000000000d1','completed'); end $$;
select tests.expect_error('transition: cannot reopen a completed trip',
  $$ select public.update_trip_status('d0000000-0000-0000-0000-0000000000d1','boarding') $$);
do $$ begin
  perform tests.check('complete: boarded booking now completed',
    (select status = 'completed' from public.get_trip_manifest('d0000000-0000-0000-0000-0000000000d1')
       where booking_id = current_setting('x.bkA')::uuid));
end $$;

-- ==========================================================================
-- 12. Capacity cannot be lowered below active reservations.
-- ==========================================================================
-- Fresh trip2 (rival) — give opstaff no access; use rival for its own trip.
reset role;
select tests.login(:'rival');
set role authenticated;
select set_config('x.bk2', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d2','e0000000-0000-0000-0000-0000000000f1',
  'e0000000-0000-0000-0000-0000000000f2',3,'Rider',null,'idem-r-1')), false);
-- (rival is operator staff for trip2, so may edit it)
select tests.expect_error('capacity: cannot drop below 3 active seats',
  $$ select public.operator_update_trip('d0000000-0000-0000-0000-0000000000d2', null, 2, null, null) $$);
do $$ begin
  perform public.operator_update_trip('d0000000-0000-0000-0000-0000000000d2', null, 20, null, null);
  perform tests.check('capacity: raising capacity to 20 succeeds',
    (select capacity = 20 from public.trips where id = 'd0000000-0000-0000-0000-0000000000d2'));
end $$;

reset role;
-- (report/assert moved to rls_report.sql so more case files can run in this session)
