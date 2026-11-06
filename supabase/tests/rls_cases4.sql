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
