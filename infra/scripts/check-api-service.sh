#!/usr/bin/env sh
set -eu

ROOT=${RINCON_POS_ROOT:-/var/www/grupolosnietos/pos}
ENV_FILE="$ROOT/.env"
ENTRYPOINT="$ROOT/apps/api/dist/src/main.js"

fail() {
  printf 'rincon-pos-api: %s\n' "$1" >&2
  exit 1
}

[ -d "$ROOT" ] || fail "no existe $ROOT"
[ -r "$ENV_FILE" ] || fail "falta $ENV_FILE o www-data no puede leerlo; cree el archivo y use chown root:www-data + chmod 640"
[ -r "$ENTRYPOINT" ] || fail "falta $ENTRYPOINT; ejecute npm ci, prisma:generate y npm run build"
command -v node >/dev/null 2>&1 || fail "node no está disponible en PATH para el servicio"

for key in DATABASE_URL REDIS_URL JWT_SECRET JWT_REFRESH_SECRET PORT HOST CORS_ORIGIN; do
  if ! sed -n "s/^${key}=.\+/ok/p" "$ENV_FILE" | grep -q '^ok$'; then
    fail "la variable $key falta o está vacía en $ENV_FILE"
  fi
done

exit 0
