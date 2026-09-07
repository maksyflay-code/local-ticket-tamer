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

# Garante a publicação usada pelo serviço de tempo real (algumas migrações alteram essa publicação)
"${PSQL[@]}" >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;
SQL

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public._migracoes_aplicadas (nome text primary key, aplicada_em timestamptz default now());" >/dev/null

# Garante a tabela usada pelo serviço de tempo real (algumas migrações criam políticas nela)
"${PSQL[@]}" >/dev/null <<'SQL'
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE TABLE IF NOT EXISTS realtime.messages (
  uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  inserted_at timestamptz NOT NULL DEFAULT now(),
  id bigserial
);
GRANT SELECT ON realtime.messages TO authenticated;
SQL

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
