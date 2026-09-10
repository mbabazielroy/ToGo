-- 0002 profiles and permission-helper functions.

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user. Public signup creates a passenger only.
-- is_platform_admin may never be set by the user themselves (enforced by trigger).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null default 'Traveller',
  phone              text,
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Per-user profile. is_platform_admin is privileged and only settable by admins/service role.';

-- New auth users get a passenger profile automatically (SECURITY DEFINER, fixed search_path).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone, is_platform_admin)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Traveller'),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    false                       -- never trust client metadata for admin
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard: forbid non-admins from flipping their own privilege bit, and keep
-- updated_at fresh. Runs with invoker rights so auth.uid() is the real caller.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.is_platform_admin is distinct from old.is_platform_admin then
    -- Only an existing admin may change this from an authenticated end-user session.
    -- A trusted server context (service_role / SQL console) has no JWT, so auth.uid()
    -- is null there — that is the documented admin-bootstrap path.
    if auth.uid() is not null and not public.is_platform_admin(auth.uid()) then
      raise exception 'Not authorised to change platform admin status';
    end if;
  end if;
  -- id can never change
  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------
-- Permission helper functions. SECURITY DEFINER so they can read assignment
-- tables regardless of the caller's own RLS, with a locked search_path.
-- They take an explicit uid and are used by both RLS policies and RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = uid), false);
$$;

-- The remaining permission helpers depend on assignment tables created in later
-- migrations, so they live in 0006b_helpers.sql (after those tables exist).
