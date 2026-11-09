-- ==========================================================================
-- API surface (0023). The shim mirrors Supabase's default grants, so these
-- checks see what a hosted project exposes.
-- ==========================================================================
reset role;

-- Signed-out visitors: the passenger views are read-only, and the only
-- function they can call is the helper the public operators policy uses.
select set_config('request.jwt.claims', '', false);
set role anon;
select tests.expect_error('api: anon cannot edit a hub through hubs_public',
  $q$update public.hubs_public set name = 'HACKED' where id = 'b0000000-0000-0000-0000-0000000000b1'$q$);
select tests.expect_error('api: anon cannot send notifications',
  $q$select public._notify('00000000-0000-0000-0000-000000000001', 'delay', 'Pay here', 'x', null, null, 'api-anon')$q$);
select tests.expect_error('api: anon cannot call staff RPCs',
  $q$select * from public.my_staff_workspaces()$q$);
do $$ begin
  perform tests.check('api: anon can still browse hubs', (select count(*) > 0 from public.hubs_public));
end $$;
reset role;

-- A signed-in passenger can't write through the views or call internal helpers.
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select tests.expect_error('api: passenger cannot edit a hub through hubs_public',
  $q$update public.hubs_public set name = 'HACKED' where id = 'b0000000-0000-0000-0000-0000000000b1'$q$);
select tests.expect_error('api: passenger cannot send another user a notification',
  $q$select public._notify('00000000-0000-0000-0000-000000000001', 'delay', 'Pay here', 'x', null, null, 'api-pB')$q$);
select tests.expect_error('api: passenger cannot write booking history',
  $q$select public._log_event(null, null, 'boarded', '00000000-0000-0000-0000-000000000002', 'forged', '{}')$q$);
select tests.expect_error('api: passenger cannot truncate tables',
  $q$truncate public.notifications$q$);
reset role;

-- Whole-schema checks, so a future migration can't quietly reopen these.
do $$
declare v text;
begin
  select string_agg(p.proname, ', ') into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'execute')
    and p.proname <> 'is_operator_member';
  perform tests.check('api: signed-out visitors can call no other functions', v is null, coalesce(v, ''));

  select string_agg(p.proname, ', ') into v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and (p.proname like '\_%' or p.prorettype = 'trigger'::regtype)
    and has_function_privilege('authenticated', p.oid, 'execute');
  perform tests.check('api: internal helpers are not callable', v is null, coalesce(v, ''));

  select string_agg(table_name || ':' || privilege_type, ', ') into v
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and table_name in ('hubs_public', 'trips_public', 'trip_stops_public') and privilege_type <> 'SELECT';
  perform tests.check('api: passenger views are read-only', v is null, coalesce(v, ''));
end $$;
