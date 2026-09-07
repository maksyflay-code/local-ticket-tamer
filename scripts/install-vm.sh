#!/usr/bin/env bash
# Instalador do sistema em uma VM, com banco de dados 100% local (Docker).
# Uso:  sudo bash scripts/install-vm.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/.env"

command -v docker >/dev/null || { echo "Docker não encontrado. Instale o Docker primeiro."; exit 1; }
docker compose version >/dev/null || { echo "Plugin 'docker compose' não encontrado."; exit 1; }

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Criando docker/.env"
  cp "$ROOT/docker/.env.example" "$ENV_FILE"

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

echo "==> Subindo banco de dados e serviços locais"
docker compose up -d db auth rest realtime storage meta kong

echo "==> Aguardando o banco ficar pronto"
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U supabase_admin >/dev/null 2>&1; then break; fi
  sleep 2
done
sleep 10  # tempo para auth/storage criarem seus schemas

echo "==> Aplicando as migrações do sistema"
bash "$ROOT/scripts/apply-migrations.sh"

echo "==> Compilando e subindo a aplicação"
docker compose up -d --build app

# shellcheck disable=SC1090
source "$ENV_FILE"
echo
echo "Pronto! Sistema disponível em: $SITE_URL"
echo "Banco de dados local (PostgreSQL) na porta $POSTGRES_PORT_EXPOSED desta VM."
