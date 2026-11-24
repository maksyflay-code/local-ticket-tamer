#!/usr/bin/env bash
# Aplica todas as migrações SQL no banco local, em ordem, uma única vez cada.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

# Carrega POSTGRES_PASSWORD do .env e passa ao psql sem pedir no teclado
set -a; . ./.env; set +a

PSQL=(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql --no-password -h 127.0.0.1 -v ON_ERROR_STOP=1 -U supabase_admin -d postgres)

# Atualiza as funções que extraem a identidade da sessão. O PostgREST atual
# envia os dados em request.jwt.claims; versões antigas usavam campos separados.
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql --no-password -h 127.0.0.1 -v ON_ERROR_STOP=1 -U supabase_auth_admin -d postgres \
  < "$ROOT/docker/init/01-auth-functions.sql" >/dev/null

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

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public._migracoes_aplicadas (nome text primary key, aplicada_em timestamptz default now()); GRANT ALL ON public._migracoes_aplicadas TO service_role;" >/dev/null

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
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT SELECT ON realtime.messages TO authenticated;
SQL

shopt -s nullglob
files=("$ROOT"/supabase/migrations/*.sql "$ROOT"/docker/migrations/*.sql)
while IFS= read -r entry; do
  f="${entry#*|}"
  name="$(basename "$f")"
  applied="$("${PSQL[@]}" -tAc "SELECT 1 FROM public._migracoes_aplicadas WHERE nome = '$name'")"
  if [ "$applied" = "1" ]; then
    echo "   - $name (já aplicada)"
    continue
  fi
  echo "   + $name"
  { cat "$f"; printf '\nINSERT INTO public._migracoes_aplicadas (nome) VALUES (\x27%s\x27);\n' "$name"; } | "${PSQL[@]}" --single-transaction >/dev/null
done < <(for f in "${files[@]}"; do printf '%s|%s\n' "$(basename "$f")" "$f"; done | sort)

echo "Migrações concluídas."

# Libera o acesso da API de dados às tabelas criadas (necessário no ambiente local)
"${PSQL[@]}" >/dev/null <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
REVOKE UPDATE, DELETE ON public.estoque_movimentos FROM authenticated;
REVOKE ALL ON FUNCTION public.registrar_materiais_os(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_materiais_os(uuid, uuid, jsonb, text) TO authenticated;
DO $$ BEGIN
  IF to_regclass('public.estoque_itens') IS NULL OR to_regclass('public.estoque_movimentos') IS NULL
     OR to_regprocedure('public.registrar_materiais_os(uuid,uuid,jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'Atualização incompleta: estoque e materiais da OS não foram instalados';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
SQL

echo "Permissões da API de dados aplicadas."

# O PostgREST pode ter iniciado antes das tabelas e funções das migrações.
# Reiniciar força a releitura completa do schema também em instalações antigas.
docker compose restart rest >/dev/null
echo "Serviço de dados atualizado."
