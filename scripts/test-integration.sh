#!/usr/bin/env bash
# Runs the data-access layer against a REAL PostgREST + PostgreSQL stack (no mocks):
#   real schema.sql, real RLS, real queries from src/lib/db/*, JWT-authenticated users.
#
# Requirements: a local PostgreSQL server + the `postgrest` binary on PATH
#   (https://github.com/PostgREST/postgrest/releases).
#
#   ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:integration
#
# It creates and drops a scratch database "pms_it". NEVER point ADMIN_URL at your real Supabase DB.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"

ADMIN_URL="${ADMIN_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB_NAME="pms_it"
PORT="${PGRST_PORT:-3200}"
SECRET="integration-test-secret-integration-test-secret"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_URL="${ADMIN_URL%/*}/${DB_NAME}"
CONF="$(mktemp)"
PGRST_PID=""

cleanup() {
  [ -n "$PGRST_PID" ] && kill "$PGRST_PID" 2>/dev/null || true
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${DB_NAME};" >/dev/null 2>&1 || true
  rm -f "$CONF"
}
trap cleanup EXIT

command -v postgrest >/dev/null || { echo "postgrest binary not found on PATH"; exit 1; }

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${DB_NAME};" -c "CREATE DATABASE ${DB_NAME};"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/sql/supabase_stub.sql"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/schema.sql"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/integration/seed.sql"

cat > "$CONF" <<CFG
db-uri = "${TEST_URL}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${SECRET}"
server-host = "127.0.0.1"
server-port = ${PORT}
CFG

postgrest "$CONF" >/tmp/postgrest.log 2>&1 &
PGRST_PID=$!
for _ in $(seq 1 40); do
  curl -s "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 && break
  sleep 0.25
done

cd "$ROOT"
PGRST_URL="http://127.0.0.1:${PORT}" PGRST_JWT_SECRET="$SECRET" npx vitest run -c vitest.integration.config.mjs
