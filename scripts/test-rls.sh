#!/usr/bin/env bash
# Verifies schema.sql and every RLS policy against a scratch database on a LOCAL
# PostgreSQL server (it stubs the Supabase roles/auth schema first).
#
#   ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:rls
#
# The scratch database "pms_rls_test" is created and dropped by this script.
# NEVER point ADMIN_URL at your real Supabase database.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"

ADMIN_URL="${ADMIN_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB_NAME="pms_rls_test"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Build the scratch DB URL by swapping the database name in ADMIN_URL.
TEST_URL="${ADMIN_URL%/*}/${DB_NAME}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${DB_NAME};" -c "CREATE DATABASE ${DB_NAME};"
trap 'psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${DB_NAME};" >/dev/null' EXIT

psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/sql/supabase_stub.sql"
echo "Applying supabase/schema.sql (first run)..."
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/schema.sql"
echo "Applying supabase/schema.sql (second run - must be idempotent)..."
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/schema.sql"
PGOPTIONS="-c client_min_messages=notice" psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$ROOT/tests/sql/rls.test.sql" 2>&1 | sed -e "s/^psql:[^ ]* NOTICE:  //" -e "s/^NOTICE:  //" | grep -v "^$"
