#!/usr/bin/env bash
# Cria (ou atualiza) o usuário administrador pelo serviço oficial de login.
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

# Carrega as chaves geradas na instalação.
set -a; . ./.env; set +a

# Evita contas com campos internos em NULL antes de qualquer operação.
bash "$ROOT/scripts/corrigir-contas.sh" >/dev/null

AUTH_ADMIN_URL="http://127.0.0.1:${APP_PORT:-8080}/auth/v1/admin/users"
USER_ID="$(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -At \
  -v email="$EMAIL" -c "select id from auth.users where lower(email) = lower(:'email') limit 1")"

PAYLOAD="$(python3 - "$EMAIL" "$SENHA" <<'PY'
import json, sys
print(json.dumps({
    "email": sys.argv[1],
    "password": sys.argv[2],
    "email_confirm": True,
    "app_metadata": {"app_role": "admin"},
}))
PY
)"

if [ -n "$USER_ID" ]; then
  METHOD=PUT
  URL="$AUTH_ADMIN_URL/$USER_ID"
else
  METHOD=POST
  URL="$AUTH_ADMIN_URL"
fi

RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT
HTTP_CODE="$(curl -sS -o "$RESPONSE_FILE" -w '%{http_code}' -X "$METHOD" "$URL" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  --data "$PAYLOAD")"

if [[ "$HTTP_CODE" != 2* ]]; then
  echo "ERRO: o serviço de login recusou a conta (HTTP $HTTP_CODE)."
  cat "$RESPONSE_FILE"
  echo
  exit 1
fi

USER_ID="$(python3 - "$RESPONSE_FILE" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as response:
    print(json.load(response)["id"])
PY
)"

docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres \
  -v user_id="$USER_ID" <<'SQL'
INSERT INTO public.user_roles (user_id, role)
VALUES (:'user_id'::uuid, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
SQL

echo "Administrador pronto: $EMAIL"
