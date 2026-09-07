#!/usr/bin/env bash
# Cria (ou atualiza) o usuário administrador do sistema.
# Uso:  sudo bash scripts/criar-admin.sh email@dominio.com "SenhaForte123"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMAIL="${1:-}"
SENHA="${2:-}"

if [ -z "$EMAIL" ] || [ -z "$SENHA" ]; then
  echo "Uso: sudo bash scripts/criar-admin.sh email@dominio.com \"SenhaForte123\""
  exit 1
fi

cd "$ROOT/docker"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres \
  -v email="$EMAIL" -v senha="$SENHA" <<'SQL'
create extension if not exists pgcrypto with schema extensions;

with upsert as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    lower(:'email'), extensions.crypt(:'senha', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  )
  on conflict (instance_id, lower(email::text)) do update
    set encrypted_password = extensions.crypt(:'senha', extensions.gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
  returning id
)
insert into public.user_roles (user_id, role)
select id, 'admin' from upsert
on conflict do nothing;
SQL

echo "Administrador pronto: $EMAIL"
