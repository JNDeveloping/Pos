#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/var/www/grupolosnietos/pos}"
cd "$ROOT"

echo "==> Verificando Node.js"
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<20 || (major===20 && minor<19)) throw new Error("Se requiere Node.js >= 20.19")'

echo "==> Instalando exactamente package-lock.json"
# Compilation, Prisma generation and tests use workspace development tools.
# --include=dev also overrides a server-wide NODE_ENV=production/npm omit setting.
npm ci --include=dev

echo "==> Eliminando fuentes offline obsoletas de despliegues superpuestos"
npm run clean:legacy
npm run check:release

echo "==> Generando Prisma y aplicando migraciones"
npm run prisma:generate
npm run db:deploy

echo "==> Compilando frontend y API"
npm run build

echo "==> Despliegue compilado. Reinicie el servicio con:"
echo "    sudo systemctl restart rincon-pos-api"
