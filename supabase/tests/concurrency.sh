#!/usr/bin/env bash
# Proves the capacity guard holds under REAL concurrency: two overlapping
# transactions both try to grab the single remaining seat; exactly one wins.
# The reserve_booking() row lock (SELECT ... FOR UPDATE on trips) serialises them.
set -euo pipefail

DB="${TOGO_CC_DB:-togo_cc}"
PSQL_BASE="${PSQL:-sudo -u postgres psql}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
psql_db() { $PSQL_BASE -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

echo "==> Recreating $DB and applying schema"
$PSQL_BASE -q -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"
psql_db -f "$ROOT/supabase/tests/00_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql_db -f "$f"; done

echo "==> Seeding a trip with a single seat"
psql_db <<'SQL'
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','a@race'),
  ('22222222-2222-2222-2222-222222222222','b@race');
insert into public.operators (id, name, slug) values ('aa000000-0000-0000-0000-0000000000a1','Op','op');
insert into public.hubs (id, name, city, area, approval_status, is_active, is_demo) values
  ('bb000000-0000-0000-0000-0000000000b1','H1','Kampala','A','approved',true,false),
  ('bb000000-0000-0000-0000-0000000000b2','H2','Mbarara','B','approved',true,false);
insert into public.trips (id, operator_id, direction, service_date, origin_departure, destination_arrival, fare_ugx, capacity, status)
  values ('cc000000-0000-0000-0000-0000000000c1','aa000000-0000-0000-0000-0000000000a1','KLA_MBR',current_date,
          now()+interval '3 hours', now()+interval '7 hours', 20000, 1, 'scheduled');
insert into public.trip_stops (id, trip_id, hub_id, stop_order, pickup_time) values
  ('dd000000-0000-0000-0000-0000000000d1','cc000000-0000-0000-0000-0000000000c1','bb000000-0000-0000-0000-0000000000b1',0, now()+interval '3 hours'),
  ('dd000000-0000-0000-0000-0000000000d2','cc000000-0000-0000-0000-0000000000c1','bb000000-0000-0000-0000-0000000000b2',1, now()+interval '7 hours');
SQL

RES="/tmp/togo_race"
CLAIMS_A='{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}'
CLAIMS_B='{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}'
RESERVE="select public.reserve_booking('cc000000-0000-0000-0000-0000000000c1','dd000000-0000-0000-0000-0000000000d1','dd000000-0000-0000-0000-0000000000d2',1,'Racer',null,null);"

echo "==> Launching two overlapping reservations"
# Session A holds the trip row lock open for 3s before committing.
( $PSQL_BASE -d "$DB" -v ON_ERROR_STOP=1 >"$RES.a" 2>&1 <<SQL || true
begin;
set local role authenticated;
select set_config('request.jwt.claims', '$CLAIMS_A', true);
$RESERVE
select pg_sleep(3);
commit;
SQL
) &
sleep 1
# Session B attempts concurrently; it blocks on the lock, then must fail SOLD_OUT.
$PSQL_BASE -d "$DB" -v ON_ERROR_STOP=1 >"$RES.b" 2>&1 <<SQL || true
set role authenticated;
select set_config('request.jwt.claims', '$CLAIMS_B', false);
$RESERVE
SQL
wait

echo "==> Session A output:"; grep -iE 'TG-|error' "$RES.a" | head -3 || true
echo "==> Session B output:"; grep -iE 'TG-|SOLD_OUT|error' "$RES.b" | head -3 || true

BOOKED=$(psql_db -tAc "select count(*) from public.bookings where trip_id='cc000000-0000-0000-0000-0000000000c1' and status='reserved';")
echo "==> Reserved bookings on the 1-seat trip: $BOOKED"
if [ "$BOOKED" = "1" ] && grep -qi 'SOLD_OUT' "$RES.b"; then
  echo "CONCURRENCY TEST: PASS (exactly one seat sold; the loser got SOLD_OUT)"
else
  echo "CONCURRENCY TEST: FAIL"; exit 1
fi
