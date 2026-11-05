-- 0019: in-app account deletion (App Store guideline 5.1.1(v), Google Play
-- account-deletion policy).
--
-- delete_my_account() permanently deletes the CALLER's own account. It never takes
-- a user id, so nobody can delete anyone else.
--
-- Rows owned by the account (profile, bookings, notifications, staff assignments,
-- location reports) already cascade from auth.users. Seat counts are derived from
-- bookings, so the caller's seats are released by the cascade. The audit columns
-- that reference a user without a cascade are cleared first, so the delete can't
-- fail on a foreign key. The audit rows themselves stay, without the person.

create or replace function public.delete_my_account()
returns void
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.booking_events set actor_id = null where actor_id = v_uid;
  update public.incidents set reporter_id = null where reporter_id = v_uid;
  update public.hubs set approved_by = null where approved_by = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
