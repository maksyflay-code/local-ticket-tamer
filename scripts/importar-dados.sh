#!/usr/bin/env bash
# Importa dados exportados do sistema antigo (arquivos CSV) para o banco local.
#
# Uso:
#   sudo bash scripts/importar-dados.sh /caminho/da/pasta-com-csv
#
# Cada arquivo deve se chamar como a tabela, por exemplo:
#   clientes.csv, chamados.csv, profiles.csv ...
# A primeira linha do arquivo precisa conter os nomes das colunas.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASTA="${1:-}"

if [ -z "$PASTA" ] || [ ! -d "$PASTA" ]; then
  echo "Informe a pasta com os arquivos CSV. Ex.: sudo bash scripts/importar-dados.sh /home/ivi/export" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$ROOT/docker/.env"
set +a

COMPOSE=(docker compose -f "$ROOT/docker/docker-compose.yml" --env-file "$ROOT/docker/.env")

psql_exec() {
  "${COMPOSE[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"
}

shopt -s nullglob
ARQUIVOS=("$PASTA"/*.csv)
if [ ${#ARQUIVOS[@]} -eq 0 ]; then
  echo "Nenhum arquivo .csv encontrado em $PASTA" >&2
  exit 1
fi

echo "Importando ${#ARQUIVOS[@]} arquivo(s)..."

for arquivo in "${ARQUIVOS[@]}"; do
  tabela="$(basename "$arquivo" .csv)"

  existe="$(psql_exec -tAc "select to_regclass('public.$tabela') is not null;" | tr -d '[:space:]')"
  if [ "$existe" != "t" ]; then
    echo "  - $tabela: tabela não existe no sistema, ignorada."
    continue
  fi

  colunas="$(head -n 1 "$arquivo" | tr -d '\r')"

  # session_replication_role = replica desliga as checagens de ligação entre
  # tabelas durante a carga, permitindo importar em qualquer ordem.
  {
    echo "set session_replication_role = replica;"
    echo "\\copy public.$tabela ($colunas) from stdin with (format csv, header true)"
    cat "$arquivo"
    echo "\\."
  } | "${COMPOSE[@]}" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
        psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres > /dev/null

  total="$(psql_exec -tAc "select count(*) from public.$tabela;" | tr -d '[:space:]')"
  echo "  - $tabela: $total registro(s) no total."
done

# Reajusta contadores automáticos com base no maior valor já existente em cada coluna.
psql_exec <<'SQL' > /dev/null
DO $$
DECLARE
  r record;
  seq text;
  maxv bigint;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  LOOP
    seq := pg_get_serial_sequence(format('public.%I', r.table_name), r.column_name);
    CONTINUE WHEN seq IS NULL;
    EXECUTE format('SELECT coalesce(max(%I), 0) FROM public.%I', r.column_name, r.table_name)
      INTO maxv;
    PERFORM setval(seq, GREATEST(maxv, 1), maxv > 0);
  END LOOP;
END
$$;
NOTIFY pgrst, 'reload schema';
SQL


bash "$ROOT/scripts/corrigir-contas.sh" >/dev/null 2>&1 || true

echo "Importação concluída."
