-- Phase-3 regression cases: privileged-profile hardening, management authority
-- separation, and explicit no-show handling. Runs after rls_cases.sql in the same
-- session (fixtures + helpers already loaded). Uses fresh ids to avoid clashes.
\set ON_ERROR_STOP on
set client_min_messages = warning;

\set admin '00000000-0000-0000-0000-000000000006'
\set rival '00000000-0000-0000-0000-000000000007'
\set conductor '00000000-0000-0000-0000-000000000004'
\set pA '00000000-0000-0000-0000-000000000001'

-- Extra users + fixtures (as superuser).
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000008', 'opstaff2@test'),
  ('00000000-0000-0000-0000-000000000009', 'bootstrap@test'),
  ('00000000-0000-0000-0000-00000000000a', 'nobody@test');
insert into public.hubs (id, name, city, area, approval_status, is_active, is_demo) values
  ('b0000000-0000-0000-0000-0000000000c6', 'Draft Hub 2', 'Kampala', 'X', 'draft', true, false);

-- ==========================================================================
-- SECURITY: privileged profile changes
-- ==========================================================================
-- (a) Anonymous cannot change a privileged field (RLS blocks; value stays false).
select tests.login('00000000-0000-0000-0000-000000000000'); -- unused; will clear
select set_config('request.jwt.claims', '', false);
set role anon;
do $$
begin
  -- No row is updatable by anon → 0 rows, no escalation.
  update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000008';
  perform tests.check('sec: anon update affects no rows', true);
exception when others then
  -- A raised error is also acceptable (still blocked).
  perform tests.check('sec: anon update blocked (error)', true);
end $$;
reset role;
do $$ begin
  perform tests.check('sec: anon did not gain admin',
    (select is_platform_admin = false from public.profiles where id = '00000000-0000-0000-0000-000000000008'));
end $$;

-- (b) Missing-claims authenticated cannot escalate via the RPC.
select set_config('request.jwt.claims', '{}', false);  -- no sub
set role authenticated;
select tests.expect_error('sec: missing-claims cannot self-promote via RPC',
  $$ select public.admin_set_platform_admin('00000000-0000-0000-0000-000000000008', true) $$);
reset role;

-- (c) Authenticated non-admin self-promote is blocked by the guard trigger.
select tests.login(:'rival');
set role authenticated;
select tests.expect_error('sec: authenticated non-admin cannot self-promote (trigger)',
  $$ update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000007' $$);
select tests.expect_error('sec: non-admin cannot promote via RPC',
  $$ select public.admin_set_platform_admin('00000000-0000-0000-0000-000000000007', true) $$);
reset role;

-- (d) Legitimate bootstrap: a trusted server role (service_role, no JWT) may set it.
select set_config('request.jwt.claims', '', false);
set role service_role;
do $$ begin
  update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000009';
  perform tests.check('sec: bootstrap via trusted role succeeds', true);
exception when others then
  perform tests.check('sec: bootstrap via trusted role succeeds', false, sqlerrm);
end $$;
reset role;
do $$ begin
  perform tests.check('sec: bootstrap target is now admin',
    (select is_platform_admin from public.profiles where id = '00000000-0000-0000-0000-000000000009'));
end $$;

-- (e) An existing admin may promote another via the governance RPC.
select tests.login(:'admin');
set role authenticated;
do $$ begin
  perform public.admin_set_platform_admin('00000000-0000-0000-0000-00000000000a', true);
  perform tests.check('sec: admin can promote another via RPC',
    (select is_platform_admin from public.profiles where id = '00000000-0000-0000-0000-00000000000a'));
end $$;
-- clean up that promotion so later scope tests are unaffected
do $$ begin perform public.admin_set_platform_admin('00000000-0000-0000-0000-00000000000a', false); end $$;
reset role;

-- ==========================================================================
-- MANAGEMENT AUTHORITY
-- ==========================================================================
-- Admin creates an operator + hub, approves the hub.
select tests.login(:'admin');
set role authenticated;
select set_config('x.op3', (select id::text from public.admin_create_operator('New Op', 'new-op')), false);
select set_config('x.hub5', (select id::text from public.admin_create_hub('Managed Hub','Kampala','Area')), false);
do $$ begin
  perform public.admin_set_hub_approval(current_setting('x.hub5')::uuid, 'approved', 'board decision #1');
  perform tests.check('mgmt: admin approved a hub',
    (select approval_status = 'approved' from public.hubs where id = current_setting('x.hub5')::uuid));
end $$;
-- Admin assigns rival's user (007) to the new operator so they can manage it.
do $$ begin perform public.admin_assign_operator_member(current_setting('x.op3')::uuid, '00000000-0000-0000-0000-000000000007', 'owner'); end $$;
reset role;

-- Operator (rival) can manage ONLY their operators.
select tests.login(:'rival');
set role authenticated;
-- an operator can NOT approve a hub (admin-only), even one they might use.
select tests.expect_error('mgmt: operator cannot approve a hub',
  $$ select public.admin_set_hub_approval(current_setting('x.hub5')::uuid, 'suspended', null) $$);
-- an operator can NOT create a platform operator.
select tests.expect_error('mgmt: operator cannot create an operator',
  $$ select public.admin_create_operator('Sneaky','sneaky') $$);
-- an operator can NOT assign hub staff (platform-managed).
select tests.expect_error('mgmt: operator cannot assign hub staff',
  $$ select public.admin_assign_hub_staff(current_setting('x.hub5')::uuid, '00000000-0000-0000-0000-000000000007') $$);
-- an operator CAN create a vehicle/route/departure for their operator.
do $$
declare v_route uuid; v_veh uuid; v_dep public.trips;
begin
  v_veh := (select id from public.operator_create_vehicle(current_setting('x.op3')::uuid, 'Bus', 'UXX 1', 20));
  perform tests.check('mgmt: operator created a vehicle', v_veh is not null);
  v_route := (select id from public.operator_create_route(current_setting('x.op3')::uuid, 'KLA_MBR', 'Kampala', 'Mbarara'));
  -- route stops must be APPROVED hubs; a draft hub is rejected.
  begin
    perform public.operator_set_route_stops(v_route, array['b0000000-0000-0000-0000-0000000000c6'::uuid, current_setting('x.hub5')::uuid]);
    perform tests.check('mgmt: route rejects unapproved hub', false, 'expected rejection');
  exception when others then
    perform tests.check('mgmt: route rejects unapproved hub', true, sqlerrm);
  end;
  -- valid stops: two approved hubs (hub5 approved + existing approved b1 from rls_cases).
  perform public.operator_set_route_stops(v_route, array[current_setting('x.hub5')::uuid, 'b0000000-0000-0000-0000-0000000000b1'::uuid]);
  -- departure with mismatched pickup-times count is rejected.
  begin
    perform public.operator_create_departure(current_setting('x.op3')::uuid, v_route, v_veh, current_date,
      now() + interval '3 hours', 20000, 20, 30, array[now() + interval '3 hours']::timestamptz[]);
    perform tests.check('mgmt: departure rejects wrong pickup-times length', false, 'expected rejection');
  exception when others then
    perform tests.check('mgmt: departure rejects wrong pickup-times length', true, sqlerrm);
  end;
  -- valid departure creates trip + 2 stops.
  v_dep := public.operator_create_departure(current_setting('x.op3')::uuid, v_route, v_veh, current_date,
    now() + interval '3 hours', 20000, 20, 30, array[now() + interval '3 hours', now() + interval '7 hours']::timestamptz[]);
  perform tests.check('mgmt: operator created a departure with stops',
    (select count(*) = 2 from public.trip_stops where trip_id = v_dep.id));
end $$;
-- operator cannot create a vehicle for a DIFFERENT operator (a1 = Savannah).
select tests.expect_error('mgmt: operator cannot add vehicle to another operator',
  $$ select public.operator_create_vehicle('a0000000-0000-0000-0000-0000000000a1','X','Y',10) $$);
reset role;

-- ==========================================================================
-- INCIDENTS
-- ==========================================================================
-- Unrelated user cannot report an incident on trip1.
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.expect_error('incident: unrelated user cannot report on a trip',
  $$ select public.report_incident('breakdown','d0000000-0000-0000-0000-0000000000d1'::uuid, null, null, 'x', 'y') $$);
reset role;
-- Assigned conductor can report + resolve; passenger cannot see staff notes.
select tests.login(:'conductor');
set role authenticated;
do $$
declare v_inc public.incidents;
begin
  v_inc := public.report_incident('breakdown','d0000000-0000-0000-0000-0000000000d1'::uuid, null, null,
    'engine warning - private', 'Minor delay while we check the bus');
  perform tests.check('incident: conductor reported incident', v_inc.id is not null);
  perform public.resolve_incident(v_inc.id, 'Checked, all clear');
  perform tests.check('incident: conductor resolved incident',
    (select status = 'resolved' from public.incidents where id = v_inc.id));
end $$;
reset role;
-- Passenger cannot read incidents at all (no policy grants it).
select tests.login(:'pA');
set role authenticated;
do $$ begin
  perform tests.check('incident: passenger cannot read incidents (no staff notes leak)',
    (select count(*) = 0 from public.incidents));
end $$;
reset role;

-- ==========================================================================
-- NO-SHOW: unboarded reservation at trip completion is not "completed"
-- ==========================================================================
-- Build a fresh trip under a1 (Savannah), assign conductor 004, passenger pA reserves + checks in, then complete.
reset role;
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d9','a0000000-0000-0000-0000-0000000000a1','KLA_MBR', current_date,
        now() + interval '2 hours', now() + interval '6 hours', 25000, 10, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('e9000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000d9','b0000000-0000-0000-0000-0000000000b1',0, now()+interval '2 hours'),
  ('e9000000-0000-0000-0000-0000000000e2','d0000000-0000-0000-0000-0000000000d9','b0000000-0000-0000-0000-0000000000b2',1, now()+interval '6 hours');
insert into public.trip_staff (trip_id, user_id, role) values ('d0000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000004','conductor');

select tests.login(:'pA');
set role authenticated;
select set_config('x.ns', (select id::text from public.reserve_booking(
  'd0000000-0000-0000-0000-0000000000d9','e9000000-0000-0000-0000-0000000000e1','e9000000-0000-0000-0000-0000000000e2',
  1,'NoShow',null,'idem-ns')), false);
do $$ begin perform public.check_in_booking(current_setting('x.ns')::uuid); end $$;
reset role;
-- Conductor completes the trip without boarding pA.
select tests.login(:'conductor');
set role authenticated;
do $$ begin perform public.update_trip_status('d0000000-0000-0000-0000-0000000000d9','completed'); end $$;
reset role;
-- Verify: booking is no_show (NOT completed), flagged unresolved, incident + notification exist.
do $$ begin
  perform tests.check('noshow: booking marked no_show (not completed)',
    (select status = 'no_show' from public.bookings where id = current_setting('x.ns')::uuid));
  perform tests.check('noshow: booking flagged unresolved',
    (select unresolved from public.bookings where id = current_setting('x.ns')::uuid));
  perform tests.check('noshow: left_unboarded incident recorded',
    (select count(*) >= 1 from public.incidents where trip_id = 'd0000000-0000-0000-0000-0000000000d9' and kind = 'left_unboarded'));
  perform tests.check('noshow: passenger notified honestly',
    (select count(*) >= 1 from public.notifications where booking_id = current_setting('x.ns')::uuid and kind = 'incident'));
end $$;

-- ==========================================================================
-- EXPOSURE REVIEW: public views / manifest must not leak credentials or contacts
-- ==========================================================================
reset role;
do $$
declare bad int;
begin
  -- No public view may expose a boarding credential, passenger phone, or internal notes.
  select count(*) into bad from information_schema.columns
   where table_schema = 'public'
     and table_name in ('trips_public','hubs_public','trip_stops_public')
     and column_name in ('boarding_credential','passenger_phone','phone','internal_notes','passenger_name','passenger_id');
  perform tests.check('exposure: public views expose no credentials/contacts/internal notes', bad = 0);

  -- The staff manifest returns operational fields only — never phone or credential.
  select count(*) into bad from information_schema.routines r
   join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'get_trip_manifest'
     and p.parameter_mode = 'OUT'
     and p.parameter_name in ('boarding_credential','passenger_phone','phone');
  perform tests.check('exposure: manifest exposes no credential/phone', bad = 0);
end $$;
