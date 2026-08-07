#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL es obligatoria}"
file="${1:?Uso: restore-postgres.sh archivo.dump}"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$file"
