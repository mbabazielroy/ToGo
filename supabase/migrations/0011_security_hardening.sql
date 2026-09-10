-- 0011 Security hardening.
--
-- Fixes the privileged-profile guard so that "no JWT identity" is NOT by itself
-- treated as a trusted caller, and documents exactly which execution identity is
-- used and why it is safe.
--
-- Identity model under Supabase:
--   * PostgREST issues every end-user API request under the Postgres role
--     `anon` (no auth) or `authenticated` (logged in), via SET ROLE, and sets the
--     request JWT into the `request.jwt.claims` GUC. `auth.uid()` reads that GUC.
--   * A SECURITY DEFINER function runs with the *owner's* rights, so `current_user`
--     becomes the owner (a trusted role such as `postgres`). Crucially, the JWT GUC
--     still reflects the real caller, so `auth.uid()` is unchanged inside definers.
--   * The Supabase service key connects as `service_role`; migrations / SQL console
--     run as `postgres`/`supabase_admin`. None of these are end-user API roles.
--
-- Therefore the trust test uses BOTH signals:
--   (1) if a JWT identity exists, it must be an existing admin — this also catches
--       a privileged definer function invoked by an ordinary user, because the JWT
--       persists into the definer; and
--   (2) if there is no JWT identity, the caller is trusted ONLY when the executing
--       role is not one of the PostgREST end-user roles (`anon`/`authenticated`).
--       An anonymous request (`anon`, no JWT) can therefore never flip the bit.
-- `current_user` (not `session_user`) is used because PostgREST changes the role
-- with SET ROLE per request; `session_user` would not reflect that.

create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_enduser_role boolean := current_user in ('anon', 'authenticated');
begin
  new.updated_at := now();

  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin then
    if v_uid is not null then
      -- (1) authenticated end-user (or a definer invoked by one) — must be admin.
      if not public.is_platform_admin(v_uid) then
        raise exception 'Not authorised to change platform admin status';
      end if;
    elsif v_enduser_role then
      -- (2) no JWT AND an end-user API role → untrusted (blocks anonymous).
      raise exception 'Not authorised to change platform admin status';
    end if;
    -- else: no JWT and a genuine server role (service_role / postgres) → trusted bootstrap.
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin-managed platform-admin promotion (governance after first bootstrap).
-- SECURITY DEFINER + explicit admin check on the *caller's* JWT identity. The
-- FIRST admin is still created by the trusted SQL bootstrap in docs/BACKEND.md;
-- this only lets an existing admin manage others from a trusted app action.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_platform_admin(p_user_id uuid, p_value boolean)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_platform_admin(v_uid) then
    raise exception 'FORBIDDEN: platform admin required';
  end if;
  if p_user_id = v_uid and p_value = false then
    raise exception 'INVALID: you cannot remove your own admin rights';
  end if;
  update public.profiles set is_platform_admin = p_value where id = p_user_id;
end;
$$;

revoke execute on function public.admin_set_platform_admin(uuid, boolean) from public;
grant execute on function public.admin_set_platform_admin(uuid, boolean) to authenticated;
