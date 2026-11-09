-- 0023 Lock down what the API can reach.
--
-- Hosted Supabase grants everything created in `public` to the API roles (anon,
-- authenticated) by default, relying on row-level security. Three gaps followed:
--
--  1. The passenger views (hubs_public, trips_public, trip_stops_public) run with
--     their owner's rights so they can show safe columns of approved rows. They
--     were also writable, and hubs_public is a simple view, so anyone, signed in
--     or not, could rename or move an approved hub through it.
--  2. Internal helpers (_notify, _log_event, ...) were callable as RPCs, so anyone
--     could send any user a notification or write booking history.
--  3. Functions added after 0010 (management, staff workspace, push, account
--     deletion) were callable by signed-out visitors. Each checks the caller
--     itself, but they should not be reachable at all.
--
-- After this migration:
--  - the passenger views are read-only for everyone;
--  - signed-out visitors can execute only is_operator_member (used by the public
--    operators policy); every RPC needs a signed-in user;
--  - internal helpers and trigger functions can't be called through the API;
--  - no API role can TRUNCATE a table (TRUNCATE ignores row-level security);
--  - new functions and tables don't get these grants by default.
-- supabase/tests/rls_cases7.sql checks all of it.

-- 1. Read-only passenger views.
revoke all on public.hubs_public, public.trips_public, public.trip_stops_public from public, anon, authenticated;
grant select on public.hubs_public, public.trips_public, public.trip_stops_public to anon, authenticated;

-- 2 and 3. Functions. Extension functions (pgcrypto, citext) are left alone: on
-- Supabase they live in the `extensions` schema, and queries on citext columns need them.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like '\_%' or f.is_trigger or f.proname = 'handle_new_user' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop;
end $$;

grant execute on function public.is_operator_member(uuid, uuid) to anon;

-- 4. TRUNCATE skips row-level security; the API never needs it.
revoke truncate on all tables in schema public from anon, authenticated;

-- 5. Don't hand future objects to the API roles automatically. New RPCs must be
-- granted to `authenticated` explicitly (as every migration here already does).
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;
