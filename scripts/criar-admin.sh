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

# Carrega a senha do banco gerada na instalação
set -a; . ./.env; set +a

docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres \
  -v email="$EMAIL" -v senha="$SENHA" <<'SQL'
create extension if not exists pgcrypto with schema extensions;
select set_config('myapp.email', :'email', false);
select set_config('myapp.senha', :'senha', false);

do $$
declare
  v_email text := lower(current_setting('myapp.email', true));
  v_senha text := current_setting('myapp.senha', true);
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email limit 1;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_senha, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );
  else
    update auth.users
       set encrypted_password = extensions.crypt(v_senha, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  begin
    insert into public.user_roles (user_id, role) values (v_id, 'admin')
    on conflict do nothing;
  exception when undefined_table or undefined_object then
    raise notice 'tabela de perfis/papeis nao encontrada, seguindo';
  end;
end $$;
SQL

echo "Administrador pronto: $EMAIL"
