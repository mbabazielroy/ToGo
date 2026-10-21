#!/usr/bin/env bash
# Grant a staff/admin role to a signed-up user on the LOCAL Supabase stack, so you
# can exercise the connected staff workspaces. Public sign-up only ever creates a
# passenger; this is the local stand-in for the admin granting real roles.
#
# Usage:
#   scripts/grant-staff.sh <email> admin
#   scripts/grant-staff.sh <email> operator  [operator_id]
#   scripts/grant-staff.sh <email> hubstaff  [hub_id]
#   scripts/grant-staff.sh <email> conductor [trip_id]
#   scripts/grant-staff.sh <email> driver    [trip_id]
#
# With no target id, the script lists the available operators / hubs / trips so you
# can copy one. The person must have signed up (created an account) first.
set -euo pipefail

DB_URL="${TOGO_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)

email="${1:-}"; role="${2:-}"; target="${3:-}"
[ -n "$email" ] && [ -n "$role" ] || { echo "Usage: scripts/grant-staff.sh <email> <admin|operator|hubstaff|conductor|driver> [target_id]"; exit 1; }

uid="$("${PSQL[@]}" -At -c "select id from auth.users where email = '$email' limit 1" 2>/dev/null || true)"
[ -n "$uid" ] || { echo "No account for '$email'. Sign up in the app first, then re-run."; exit 1; }
echo "User $email → $uid"

list_targets() {
  case "$1" in
    operator)  echo "Operators:"; "${PSQL[@]}" -c "select id, name from public.operators order by name";;
    hubstaff)  echo "Hubs:";      "${PSQL[@]}" -c "select id, name, city from public.hubs where approval_status='approved' order by city";;
    conductor|driver) echo "Trips:"; "${PSQL[@]}" -c "select id, direction, service_date, origin_departure from public.trips order by origin_departure limit 20";;
  esac
}

case "$role" in
  admin)
    "${PSQL[@]}" -c "select set_config('togo.admin_bootstrap','on',false);
                     update public.profiles set is_platform_admin = true where id = '$uid';
                     select set_config('togo.admin_bootstrap','',false);"
    echo "Granted: platform admin."
    ;;
  operator)
    [ -n "$target" ] || { list_targets operator; echo; echo "Re-run with: scripts/grant-staff.sh $email operator <operator_id>"; exit 0; }
    "${PSQL[@]}" -c "insert into public.operator_members (operator_id, user_id, role) values ('$target','$uid','owner')
                     on conflict (operator_id, user_id) do update set role='owner';"
    echo "Granted: operator owner on $target."
    ;;
  hubstaff)
    [ -n "$target" ] || { list_targets hubstaff; echo; echo "Re-run with: scripts/grant-staff.sh $email hubstaff <hub_id>"; exit 0; }
    "${PSQL[@]}" -c "insert into public.hub_staff (hub_id, user_id) values ('$target','$uid') on conflict do nothing;"
    echo "Granted: hub attendant at $target."
    ;;
  conductor|driver)
    [ -n "$target" ] || { list_targets "$role"; echo; echo "Re-run with: scripts/grant-staff.sh $email $role <trip_id>"; exit 0; }
    "${PSQL[@]}" -c "insert into public.trip_staff (trip_id, user_id, role) values ('$target','$uid','$role')
                     on conflict (trip_id, user_id) do update set role='$role';"
    echo "Granted: $role on trip $target."
    ;;
  *)
    echo "Unknown role '$role'. Use: admin | operator | hubstaff | conductor | driver"; exit 1;;
esac
