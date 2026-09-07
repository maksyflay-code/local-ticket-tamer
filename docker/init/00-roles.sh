#!/bin/bash
# Cria as roles e schemas internos do Supabase self-hosted e define suas senhas.
# Executado apenas na primeira inicializacao do banco.
set -e

PSQL_CONNECTION=(--host 127.0.0.1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")
if [ "${REPAIR_EXISTING_DB:-false}" = "true" ]; then
  # Em volumes existentes, a senha gravada no PostgreSQL pode ser diferente
  # da senha atual do .env. O usuário local postgres entra por autenticação
  # peer e consegue sincronizá-la sem solicitar senha no terminal.
  unset PGPASSWORD
  PSQL_CONNECTION=(--username postgres --dbname "$POSTGRES_DB")
else
  export PGPASSWORD="$POSTGRES_PASSWORD"
fi

psql -v ON_ERROR_STOP=1 "${PSQL_CONNECTION[@]}" \
  -v pgpass="$POSTGRES_PASSWORD" <<'SQL'
-- ---------- roles sem login ----------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', r);
    END IF;
  END LOOP;
END $$;

-- Variaveis do psql nao sao expandidas dentro de blocos DO com dollar quote.
-- Geramos os comandos como linhas SQL e usamos \gexec para aplicar a senha.
SELECT format('CREATE ROLE %I LOGIN NOINHERIT PASSWORD %L', role_name, :'pgpass')
FROM unnest(ARRAY[
  'authenticator','pgbouncer','supabase_auth_admin','supabase_functions_admin',
  'supabase_storage_admin','supabase_read_only_user','supabase_replication_admin',
  'supabase_realtime_admin','dashboard_user'
]) AS roles(role_name)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name)
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', role_name, :'pgpass')
FROM unnest(ARRAY[
  'authenticator','pgbouncer','supabase_auth_admin','supabase_functions_admin',
  'supabase_storage_admin','supabase_read_only_user','supabase_replication_admin',
  'supabase_realtime_admin','dashboard_user'
]) AS roles(role_name)
\gexec

SELECT format('ALTER ROLE supabase_admin WITH LOGIN PASSWORD %L', :'pgpass')
\gexec

ALTER ROLE authenticator NOINHERIT;
ALTER ROLE supabase_auth_admin WITH CREATEROLE CREATEDB;
ALTER ROLE supabase_storage_admin WITH CREATEROLE;
ALTER ROLE supabase_realtime_admin WITH CREATEROLE;
ALTER ROLE supabase_replication_admin WITH REPLICATION;
ALTER ROLE dashboard_user WITH CREATEROLE CREATEDB REPLICATION;

GRANT anon, authenticated, service_role TO authenticator;
GRANT anon, authenticated, service_role TO supabase_admin;
GRANT ALL ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin, supabase_realtime_admin;

-- ---------- schemas ----------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA IF NOT EXISTS realtime AUTHORIZATION supabase_admin;
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;
CREATE SCHEMA IF NOT EXISTS graphql_public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

ALTER ROLE supabase_realtime_admin IN DATABASE postgres SET search_path TO _realtime, public;
GRANT ALL ON SCHEMA _realtime TO supabase_admin, supabase_realtime_admin;
GRANT ALL ON SCHEMA realtime TO supabase_admin, supabase_realtime_admin;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ---------- auth.uid()/auth.role()/auth.jwt() ----------
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  ), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(
    current_setting('request.jwt.claim.role', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
  ), '')::text
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(
    current_setting('request.jwt.claim.email', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  ), '')::text
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.email(), auth.jwt()
  TO anon, authenticated, service_role;
SQL
