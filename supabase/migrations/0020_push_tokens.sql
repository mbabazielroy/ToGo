-- 0020: push alerts for delays, cancellations and schedule changes.
--
-- The ToGo app registers its Expo push token here once the passenger allows
-- notifications and has "Delays and changes" turned on, and removes it when they
-- sign out or turn the alerts off. A server function (supabase/functions/push)
-- sends a push for each new service alert in public.notifications.
--
-- Clients never write this table directly: they call register_push_token /
-- unregister_push_token, which only ever act for the signed-in caller. A token
-- belongs to one account at a time; if another person signs in on the same phone,
-- the token moves to them. Tokens are deleted with the account (cascade).

create table if not exists public.push_tokens (
  token       text primary key check (char_length(token) between 10 and 300),
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- People can see their own registrations (for support and tests). No direct
-- writes: the functions below are the only way in or out.
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
grant select on public.push_tokens to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_token is null or char_length(p_token) not between 10 and 300 then
    raise exception 'INVALID_TOKEN';
  end if;
  if p_platform not in ('ios', 'android') then raise exception 'INVALID_PLATFORM'; end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public;
revoke execute on function public.unregister_push_token(text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
