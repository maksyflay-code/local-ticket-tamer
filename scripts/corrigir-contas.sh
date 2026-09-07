#!/usr/bin/env bash
# Corrige contas com campos internos em NULL, que fazem o serviço de login
# responder "Database error querying schema" (erro 500) ao entrar.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"
set -a; . ./.env; set +a

docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres <<'SQL'
UPDATE auth.users SET
  confirmation_token       = COALESCE(confirmation_token, ''),
  recovery_token           = COALESCE(recovery_token, ''),
  email_change             = COALESCE(email_change, ''),
  email_change_token_new   = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change             = COALESCE(phone_change, ''),
  phone_change_token       = COALESCE(phone_change_token, ''),
  reauthentication_token   = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;
SQL

echo "Contas normalizadas."
