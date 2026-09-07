#!/usr/bin/env bash
# Instalador do sistema em uma VM, com banco de dados 100% local (Docker).
# Uso:  sudo bash scripts/install-vm.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/.env"

command -v docker >/dev/null || { echo "Docker não encontrado. Instale o Docker primeiro."; exit 1; }
docker compose version >/dev/null || { echo "Plugin 'docker compose' não encontrado."; exit 1; }

NEEDS_CONFIG=false
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/docker/.env.example" "$ENV_FILE"
  NEEDS_CONFIG=true
elif grep -q '^POSTGRES_PASSWORD=troque-esta-senha$' "$ENV_FILE" \
  || grep -qE '^(JWT_SECRET|SECRET_KEY_BASE|ANON_KEY|SERVICE_ROLE_KEY)=$' "$ENV_FILE"; then
  NEEDS_CONFIG=true
fi

if [ "$NEEDS_CONFIG" = true ]; then
  echo "==> Configurando docker/.env"

  read -rp "Endereço de acesso ao sistema (ex: http://192.168.0.10:8080): " SITE
  SITE="${SITE:-http://localhost:8080}"
  HOSTPART="$(echo "$SITE" | sed -E 's#(https?://[^:/]+).*#\1#')"

  if command -v node >/dev/null; then
    KEYS="$(node "$ROOT/scripts/gen-keys.mjs")"
  else
    KEYS="$(docker run --rm -v "$ROOT/scripts:/s:ro" node:22-alpine node /s/gen-keys.mjs)"
  fi


  PGPASS="$(openssl rand -hex 16)"

  set_env() { sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; }
  set_env SITE_URL "$SITE"
  set_env SUPABASE_PUBLIC_URL "$HOSTPART:8000"
  set_env POSTGRES_PASSWORD "$PGPASS"
  while IFS= read -r line; do set_env "${line%%=*}" "${line#*=}"; done <<< "$KEYS"

  echo "==> Chaves geradas em docker/.env"
fi

cd "$ROOT/docker"

# Usa sempre os valores atuais do arquivo, inclusive quando o contêiner já
# existia e ainda guarda variáveis antigas em seu ambiente.
# shellcheck disable=SC1090
source "$ENV_FILE"

echo "==> Subindo banco de dados local"
docker compose up -d db

echo "==> Aguardando o banco ficar pronto"
DB_READY=false
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then
    DB_READY=true
    break
  fi
  sleep 2
done
if [ "$DB_READY" != true ]; then
  echo "ERRO: o banco não ficou pronto. Execute: docker logs ivi-db --tail 100"
  exit 1
fi

echo "==> Conferindo contas internas do banco"
# Evita que o serviço tente migrar o schema auth ao mesmo tempo em que o
# instalador corrige permissões deixadas por uma tentativa anterior.
docker compose stop auth >/dev/null 2>&1 || true
if docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql --no-password --host 127.0.0.1 --username supabase_admin \
  --dbname "$POSTGRES_DB" -tAc 'select 1' >/dev/null 2>&1; then
  docker compose exec -T \
    -e REPAIR_EXISTING_DB=true \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    db bash /docker-entrypoint-initdb.d/00-roles.sh
else
  echo "==> Recuperando senha de uma instalação anterior"
  HBA_BACKUP="/tmp/pg_hba.conf.install-vm-backup"
  restore_hba() {
    docker compose exec -T -u root db sh -c \
      "test ! -f '$HBA_BACKUP' || { cp '$HBA_BACKUP' /etc/postgresql/pg_hba.conf; rm -f '$HBA_BACKUP'; kill -HUP 1; }" \
      >/dev/null 2>&1 || true
  }
  trap restore_hba EXIT

  docker compose exec -T -u root db sh -c \
    "cp /etc/postgresql/pg_hba.conf '$HBA_BACKUP' && sed -i '1i host all all 127.0.0.1/32 trust' /etc/postgresql/pg_hba.conf && kill -HUP 1"

  docker compose exec -T \
    -e REPAIR_EXISTING_DB=true \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e PGPASSWORD= \
    db bash /docker-entrypoint-initdb.d/00-roles.sh

  restore_hba
  trap - EXIT
fi

echo "==> Conferindo propriedade das funções de autenticação"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql --no-password --host 127.0.0.1 --username supabase_admin \
  --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
SELECT format('ALTER FUNCTION %I.%I() OWNER TO supabase_auth_admin', n.nspname, p.proname)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'auth'
  AND p.proname IN ('uid', 'role', 'email', 'jwt')
  AND p.pronargs = 0
\gexec
SQL

if ! docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql --no-password --host 127.0.0.1 --username supabase_admin \
  --dbname "$POSTGRES_DB" -tAc \
  "select count(*) = 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='auth' and p.proname in ('uid','role') and p.pronargs=0 and r.rolname <> 'supabase_auth_admin'" \
  | tr -d '[:space:]' | grep -qx 't'; then
  echo "ERRO: não foi possível transferir as funções auth.* para o serviço de usuários."
  exit 1
fi

echo "==> Subindo os demais serviços locais"
docker compose up -d auth rest realtime storage meta kong

echo "==> Aguardando o serviço de usuários preparar o banco"
AUTH_READY=false
for i in $(seq 1 60); do
  if docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    psql --no-password --host 127.0.0.1 --username supabase_admin \
    --dbname "$POSTGRES_DB" -tAc "select to_regclass('auth.users') is not null" \
    | grep -qx 't'; then
    AUTH_READY=true
    break
  fi

  if ! docker compose ps --status running --services | grep -qx 'auth'; then
    echo "ERRO: o serviço de usuários parou antes de preparar o banco."
    echo "Execute: docker logs ivi-auth --tail 100"
    exit 1
  fi
  sleep 2
done
if [ "$AUTH_READY" != true ]; then
  echo "ERRO: a tabela auth.users não foi criada no tempo esperado."
  echo "Execute: docker logs ivi-auth --tail 100"
  exit 1
fi

echo "==> Finalizando funções de autenticação"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql --no-password --host 127.0.0.1 --username supabase_auth_admin \
  --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  < "$ROOT/docker/init/01-auth-functions.sql"

echo "==> Aplicando as migrações do sistema"
bash "$ROOT/scripts/apply-migrations.sh"

echo "==> Compilando e subindo a aplicação"
docker compose up -d --build app

echo
echo "Pronto! Sistema disponível em: $SITE_URL"
echo "Banco de dados local (PostgreSQL) na porta $POSTGRES_PORT_EXPOSED desta VM."
