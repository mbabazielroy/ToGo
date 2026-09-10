-- 0014 Make the privileged-profile trust boundary EXPLICIT.
--
-- Why 0011's guard was fragile (audit follow-up):
--   0011 granted a no-JWT change when `current_user` was not an end-user API role
--   (anon/authenticated). But `current_user` is the EXECUTION-CONTEXT role, and a
--   SECURITY DEFINER function owned by `postgres` runs with current_user=postgres —
--   so *any* caller of such a function (even `anon`) presents current_user=postgres
--   inside it. If a publicly-executable definer ever updated profiles with no JWT,
--   the role blacklist would have wrongly trusted it.
--
--   Reachability at the time of writing: the ONLY definer that writes
--   is_platform_admin is `admin_set_platform_admin`, which itself requires an admin
--   JWT and is not granted to anon. `handle_new_user` hard-codes false. So the
--   condition was a dangerous latent weakness, NOT an accessible exploit — but role
--   inference is the wrong basis for trust regardless.
--
-- New trust boundary (no role inference): a change to is_platform_admin is allowed
-- ONLY when either
--   (a) the caller has an admin JWT identity (auth.uid() is an existing admin) —
--       this is the app path via admin_set_platform_admin, and covers an admin's
--       own direct session; OR
--   (b) an explicit, deliberately-set bootstrap marker is present in the session:
--       `togo.admin_bootstrap = 'on'`. Clients cannot set custom GUCs through
--       PostgREST (it only sets request.* from the JWT and calls whitelisted RPCs),
--       and no function sets this marker, so it can only be set by someone with
--       direct SQL/superuser access — i.e. a genuinely trusted context.
-- Everything else (anonymous, missing claims, ordinary users, and any definer path
-- lacking an admin JWT) is denied.

create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_bootstrap boolean := coalesce(current_setting('togo.admin_bootstrap', true), '') = 'on';
begin
  new.updated_at := now();

  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin then
    if v_uid is not null and public.is_platform_admin(v_uid) then
      null; -- (a) existing admin, identified by JWT (persists into definers)
    elsif v_bootstrap then
      null; -- (b) explicit trusted bootstrap marker set via direct SQL access
    else
      raise exception 'Not authorised to change platform admin status';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.profiles_guard() is
  'Blocks is_platform_admin changes unless the caller is an admin (JWT) or the explicit togo.admin_bootstrap marker is set by a trusted SQL/server context.';
