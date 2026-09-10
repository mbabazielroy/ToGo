-- RLS + transactional-function test suite. Run against a DB that already has the
-- shim + migrations applied. Uses SET ROLE + request.jwt.claims to simulate real
-- authenticated users, so this proves the actual database policies — not mocks.
--
-- Convention: helpers below set/clear the "logged in" user. Superuser (postgres)
-- seeds data bypassing RLS, mirroring service-role/admin setup.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;

-- --------------------------------------------------------------------------
-- Seed fixture data as superuser (bypasses RLS).
-- --------------------------------------------------------------------------
-- Users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'passengerA@test'),
  ('00000000-0000-0000-0000-000000000002', 'passengerB@test'),
  ('00000000-0000-0000-0000-000000000003', 'opstaff@test'),
  ('00000000-0000-0000-0000-000000000004', 'conductor@test'),
  ('00000000-0000-0000-0000-000000000005', 'attendant@test'),
  ('00000000-0000-0000-0000-000000000006', 'admin@test'),
  ('00000000-0000-0000-0000-000000000007', 'otheropstaff@test');
-- Profiles are auto-created by the trigger; make #6 an admin via the explicit
-- bootstrap marker (the documented trusted-context path). Cleared immediately after.
select set_config('togo.admin_bootstrap', 'on', false);
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000006';
select set_config('togo.admin_bootstrap', '', false);

-- Operators
insert into public.operators (id, name, slug) values
  ('a0000000-0000-0000-0000-0000000000a1', 'Savannah Coaches', 'savannah'),
  ('a0000000-0000-0000-0000-0000000000a2', 'Rival Movers', 'rival');
insert into public.operator_members (operator_id, user_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003', 'owner'),
  ('a0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000007', 'owner');

-- Hubs (approved + demo)
insert into public.hubs (id, name, city, area, approval_status, is_active, is_demo, internal_notes) values
  ('b0000000-0000-0000-0000-0000000000b1', 'Nakawa Green Hub', 'Kampala', 'Nakawa', 'approved', true, false, 'secret ops note'),
  ('b0000000-0000-0000-0000-0000000000b2', 'Mbarara Central Hub', 'Mbarara', 'Central', 'approved', true, false, null),
  ('b0000000-0000-0000-0000-0000000000b3', 'Pending Hub', 'Kampala', 'Somewhere', 'pending', true, false, null);
insert into public.hub_staff (hub_id, user_id) values
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000005');

-- Vehicle + trip + stops (capacity intentionally small to test the last-seat race)
insert into public.vehicles (id, operator_id, label, plate, capacity) values
  ('c0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000a1', 'Coaster', 'UAX 1', 4);
insert into public.trips (id, operator_id, vehicle_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-0000000000a1',
        'c0000000-0000-0000-0000-0000000000c1', 'KLA_MBR', current_date,
        now() + interval '3 hours', now() + interval '7 hours', 25000, 4, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('e0000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-0000000000b1', 0, now() + interval '3 hours'),
  ('e0000000-0000-0000-0000-0000000000e2', 'd0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-0000000000b2', 1, now() + interval '7 hours');
insert into public.trip_staff (trip_id, user_id, role) values
  ('d0000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000004', 'conductor');

-- A second trip for cross-trip credential test, owned by the RIVAL operator.
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
values ('d0000000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-0000000000a2', 'KLA_MBR', current_date,
        now() + interval '4 hours', now() + interval '8 hours', 30000, 10, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('e0000000-0000-0000-0000-0000000000f1', 'd0000000-0000-0000-0000-0000000000d2', 'b0000000-0000-0000-0000-0000000000b1', 0, now() + interval '4 hours'),
  ('e0000000-0000-0000-0000-0000000000f2', 'd0000000-0000-0000-0000-0000000000d2', 'b0000000-0000-0000-0000-0000000000b2', 1, now() + interval '8 hours');

-- --------------------------------------------------------------------------
-- Login helpers.
-- --------------------------------------------------------------------------
create or replace function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end; $$;

-- Assertion counter
create table if not exists tests.results (name text, passed boolean, detail text);

create or replace function tests.check(p_name text, p_passed boolean, p_detail text default '') returns void
language plpgsql as $$ begin insert into tests.results values (p_name, p_passed, p_detail); end $$;

-- Expect an expression (as SQL text) to raise; record pass/fail.
create or replace function tests.expect_error(p_name text, p_sql text) returns void
language plpgsql as $$
begin
  execute p_sql;
  perform tests.check(p_name, false, 'expected an error but none was raised');
exception when others then
  perform tests.check(p_name, true, sqlerrm);
end $$;

-- Let simulated authenticated/anon users record results and call helpers.
grant all on tests.results to authenticated, anon, service_role;
grant execute on function tests.login(uuid), tests.check(text, boolean, text),
  tests.expect_error(text, text) to authenticated, anon, service_role;

-- Faithfully model Supabase: the service_role has full table access (and BYPASSRLS,
-- set in the shim). Real Supabase grants these by default; the shim ran before the
-- tables existed, so grant them now for the trusted-bootstrap test path.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant execute on all routines in schema public to service_role;
