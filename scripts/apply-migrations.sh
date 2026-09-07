#!/usr/bin/env bash
# Aplica todas as migrações SQL no banco local, em ordem, uma única vez cada.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

# Carrega POSTGRES_PASSWORD do .env e passa ao psql sem pedir no teclado
set -a; . ./.env; set +a

PSQL=(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres)

# Garante que funcoes como crypt()/gen_salt() fiquem visiveis nas migracoes
"${PSQL[@]}" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;" >/dev/null
"${PSQL[@]}" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA extensions;" >/dev/null
"${PSQL[@]}" -c "ALTER DATABASE postgres SET search_path TO public, extensions;" >/dev/null
PSQL+=(-v ON_ERROR_STOP=1)

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public._migracoes_aplicadas (nome text primary key, aplicada_em timestamptz default now());" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  applied="$("${PSQL[@]}" -tAc "SELECT 1 FROM public._migracoes_aplicadas WHERE nome = '$name'")"
  if [ "$applied" = "1" ]; then
    echo "   - $name (já aplicada)"
    continue
  fi
  echo "   + $name"
  "${PSQL[@]}" < "$f" >/dev/null
  "${PSQL[@]}" -c "INSERT INTO public._migracoes_aplicadas (nome) VALUES ('$name');" >/dev/null
done

echo "Migrações concluídas."
