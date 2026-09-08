#!/bin/bash
# Envia para o armazenamento local os arquivos (PDFs) do sistema antigo.
#
# Uso:
#   bash scripts/importar-arquivos.sh /home/ivi/export/arquivos
#
# A pasta informada deve manter a mesma estrutura de caminhos usada no sistema
# antigo, por exemplo:
#   /home/ivi/export/arquivos/rfo/xxxxxxxx-xxxx-....pdf
set -euo pipefail

ORIGEM="${1:-/home/ivi/export/arquivos}"
BUCKET="${2:-documentos-gerados}"

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$RAIZ/docker/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$RAIZ/.env"
[ -f "$ENV_FILE" ] || { echo "Arquivo .env nao encontrado."; exit 1; }
set -a; . "$ENV_FILE"; set +a

BASE_URL="${SUPABASE_PUBLIC_URL:-http://127.0.0.1:8000}"
KEY="${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY ausente no .env}"

[ -d "$ORIGEM" ] || { echo "Pasta nao encontrada: $ORIGEM"; exit 1; }

enviados=0; falhas=0
while IFS= read -r -d '' arquivo; do
  destino="${arquivo#$ORIGEM/}"
  tipo="application/octet-stream"
  case "$arquivo" in
    *.pdf) tipo="application/pdf" ;;
    *.png) tipo="image/png" ;;
    *.jpg|*.jpeg) tipo="image/jpeg" ;;
  esac

  codigo=$(curl -s -o /tmp/upload-resp.txt -w '%{http_code}' \
    -X POST "$BASE_URL/storage/v1/object/$BUCKET/$destino" \
    -H "Authorization: Bearer $KEY" \
    -H "apikey: $KEY" \
    -H "x-upsert: true" \
    -H "Content-Type: $tipo" \
    --data-binary "@$arquivo")

  if [ "$codigo" = "200" ] || [ "$codigo" = "201" ]; then
    enviados=$((enviados + 1))
    echo "ok   $destino"
  else
    falhas=$((falhas + 1))
    echo "FALHA ($codigo) $destino: $(cat /tmp/upload-resp.txt)"
  fi
done < <(find "$ORIGEM" -type f -print0)

echo
echo "Arquivos enviados: $enviados | falhas: $falhas"
