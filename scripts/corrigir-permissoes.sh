#!/usr/bin/env bash
# Libera o acesso da API de dados (PostgREST) a todas as tabelas do sistema
# e mostra um diagnóstico do estado das permissões.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/docker"

set -a; . ./.env; set +a

PSQL=(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres)

echo "Aplicando permissões..."
"${PSQL[@]}" >/dev/null <<'SQL'
ALTER ROLE service_role WITH BYPASSRLS;
ALTER ROLE supabase_admin WITH BYPASSRLS;

-- O serviço de arquivos precisa assumir o papel do usuário (SET ROLE) para
-- avaliar as políticas de acesso; sem isso qualquer download falha.
GRANT anon, authenticated, service_role TO supabase_storage_admin;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT c.relname AS nome
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', obj.nome);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', obj.nome);
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SQL

echo
echo "Tabelas ainda sem leitura para usuários logados (deve vir vazio):"
"${PSQL[@]}" -c "
SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r','p','v','m')
   AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
 ORDER BY 1;"

docker compose restart rest >/dev/null
echo "Serviço de dados reiniciado. Atualize a página com Ctrl+Shift+R."
