#!/bin/bash
# Ajusta as senhas das roles internas do Supabase self-hosted.
# Executado apenas na primeira inicializacao do banco.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v pgpass="$POSTGRES_PASSWORD" <<'SQL'
DO $$
DECLARE
  r text;
  pass text := :'pgpass';
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'authenticator','pgbouncer','supabase_auth_admin','supabase_functions_admin',
    'supabase_storage_admin','supabase_read_only_user','supabase_replication_admin',
    'supabase_realtime_admin'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', r, pass);
    END IF;
  END LOOP;
END
$$;
SQL
