-- ==========================================================================
-- Push tokens (0020): each person registers and removes only their own phones;
-- no direct writes; a token moves to whoever signs in on that phone; tokens go
-- with the account.
-- ==========================================================================
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000098', 'pushleaver@test');

-- Signed out: refused.
select tests.login(null);
set role anon;
select tests.expect_error('push: anonymous register rejected',
  $$ select public.register_push_token('ExponentPushToken[anon-000000]', 'ios') $$);
reset role;

-- Passenger A registers a phone.
select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select public.register_push_token('ExponentPushToken[phone-A-0001]', 'ios');
select tests.expect_error('push: bad platform rejected',
  $$ select public.register_push_token('ExponentPushToken[phone-A-0002]', 'windows') $$);
select tests.expect_error('push: too-short token rejected',
  $$ select public.register_push_token('short', 'ios') $$);
select tests.expect_error('push: no direct insert',
  $$ insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[direct-0001]', '00000000-0000-0000-0000-000000000001', 'ios') $$);
do $$ begin
  perform tests.check('push: owner sees own token',
    (select count(*) = 1 from public.push_tokens where token = 'ExponentPushToken[phone-A-0001]'));
end $$;
reset role;

-- Passenger B can't see A's token, and can't remove it.
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
do $$ begin
  perform tests.check('push: others cannot see a token',
    (select count(*) = 0 from public.push_tokens where token = 'ExponentPushToken[phone-A-0001]'));
end $$;
select public.unregister_push_token('ExponentPushToken[phone-A-0001]');
reset role;
do $$ begin
  perform tests.check('push: others cannot remove a token',
    exists (select 1 from public.push_tokens where token = 'ExponentPushToken[phone-A-0001]'
            and user_id = '00000000-0000-0000-0000-000000000001'));
end $$;

-- B signs in on A's phone: the token moves to B.
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select public.register_push_token('ExponentPushToken[phone-A-0001]', 'ios');
reset role;
do $$ begin
  perform tests.check('push: token moves to the person now signed in',
    (select user_id = '00000000-0000-0000-0000-000000000002' from public.push_tokens
     where token = 'ExponentPushToken[phone-A-0001]'));
end $$;

-- B removes it on sign-out.
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select public.unregister_push_token('ExponentPushToken[phone-A-0001]');
reset role;
do $$ begin
  perform tests.check('push: owner can remove own token',
    not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[phone-A-0001]'));
end $$;

-- Tokens are deleted with the account.
select tests.login('00000000-0000-0000-0000-000000000098');
set role authenticated;
select public.register_push_token('ExponentPushToken[leaver-0001]', 'android');
select public.delete_my_account();
reset role;
do $$ begin
  perform tests.check('push: tokens deleted with the account',
    not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[leaver-0001]'));
end $$;
