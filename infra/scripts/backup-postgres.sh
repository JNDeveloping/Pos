#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL es obligatoria}"
out="${1:-backups/rincon-$(date -u +%Y%m%dT%H%M%SZ).dump}"
mkdir -p "$(dirname "$out")"
pg_dump --format=custom --no-owner --file="$out" "$DATABASE_URL"
echo "Backup creado: $out"
