-- 0006b permission helpers that depend on the assignment tables.
-- SECURITY DEFINER + fixed search_path so RLS policies can call them safely.

create or replace function public.is_operator_member(uid uuid, p_operator_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.operator_members m
    where m.operator_id = p_operator_id and m.user_id = uid
  ) or public.is_platform_admin(uid);
$$;

create or replace function public.is_hub_staff(uid uuid, p_hub_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.hub_staff h
    where h.hub_id = p_hub_id and h.user_id = uid
  ) or public.is_platform_admin(uid);
$$;

create or replace function public.is_trip_staff(uid uuid, p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.trip_staff ts
    where ts.trip_id = p_trip_id and ts.user_id = uid
  );
$$;

create or replace function public.trip_operator(p_trip_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select t.operator_id from public.trips t where t.id = p_trip_id;
$$;

create or replace function public.can_manage_trip(uid uuid, p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_trip_staff(uid, p_trip_id)
      or public.is_operator_member(uid, public.trip_operator(p_trip_id));
$$;
