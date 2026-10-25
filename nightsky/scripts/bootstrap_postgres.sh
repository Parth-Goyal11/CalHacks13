#!/usr/bin/env bash
# Create the local nightsky role and database. Safe to run more than once.
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Start Postgres with: docker compose up -d" >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nightsky') THEN
    CREATE ROLE nightsky LOGIN PASSWORD 'nightsky';
  END IF;
END
$$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'nightsky'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE nightsky OWNER nightsky;"
fi

sudo -u postgres psql -d nightsky -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO nightsky;"
echo "Postgres database nightsky is ready."
