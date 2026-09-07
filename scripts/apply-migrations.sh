#!/usr/bin/env bash
# Aplica todas as migrações SQL no banco local, em ordem, uma única vez cada.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

PSQL=(docker compose exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres)

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
