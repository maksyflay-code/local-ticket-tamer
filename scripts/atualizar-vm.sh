#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash scripts/apply-migrations.sh
docker compose -f docker/docker-compose.yml build --no-cache app
docker compose -f docker/docker-compose.yml up -d --force-recreate app
docker compose -f docker/docker-compose.yml restart gateway
docker compose -f docker/docker-compose.yml ps
echo "Atualização concluída. Atualize a página com Ctrl+F5."