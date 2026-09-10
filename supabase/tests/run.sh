#!/usr/bin/env bash
# Apply the shim + migrations to a throwaway database and run the RLS/transaction
# test suite against a REAL PostgreSQL. Proves database policies, not mocks.
#
# Usage: supabase/tests/run.sh
# Requires: a reachable PostgreSQL superuser. Override with PSQL env if needed.
set -euo pipefail

DB="${TOGO_TEST_DB:-togo_test}"
PSQL="${PSQL:-sudo -u postgres psql}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> Recreating database $DB"
$PSQL -q -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"

echo "==> Applying auth shim"
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/supabase/tests/00_shim.sql"

echo "==> Applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done

echo "==> Running RLS + transaction tests"
# Fixtures/helpers and cases run in a single psql session so GUCs persist.
cat "$ROOT/supabase/tests/rls_test.sql" "$ROOT/supabase/tests/rls_cases.sql" \
  | $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f -
