#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres database and runs the
# SQL tests. Usage: DATABASE_URL=postgres://... supabase/tests/run-local.sh
# The target database must be empty and disposable.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Set DATABASE_URL to an empty, disposable Postgres database}"
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }
run tests/00_supabase_stub.sql
for f in migrations/*.sql; do run "$f"; done
for f in tests/*.test.sql; do run "$f"; done
