# Despliegue en `grupolosnietos.com.ar/pos`

La PWA se compila con base `/pos/`, consume la API por la URL relativa `/pos/api` y la API escucha por defecto
exclusivamente en `127.0.0.1:3002`. Esto evita interferir con la API existente en el puerto 3001 y evita publicar
NestJS directamente a Internet.

## Variables de producción

```dotenv
NODE_ENV=production
PORT=3002
HOST=127.0.0.1
CORS_ORIGIN=https://grupolosnietos.com.ar
VITE_BASE_PATH=/pos/
VITE_API_URL=/pos/api
```

Además se deben definir `DATABASE_URL`, `REDIS_URL`, secretos JWT robustos y `SEED_ADMIN_PASSWORD`. El frontend usa
`VITE_*` durante el build; por eso hay que compilar nuevamente si cambia la ruta pública.

## Build y publicación

```bash
npm ci
npm run prisma:generate
npm run db:deploy
npm run build
sudo mkdir -p /var/www/grupolosnietos/pos
sudo rsync -a --delete apps/admin/dist/ /var/www/grupolosnietos/pos/
```

Ejecutar la API con systemd, PM2 o Docker en el puerto 3002. Se incluye una unidad base en
`infra/systemd/rincon-pos-api.service`; al usarla, el repositorio y `.env` deben estar en `/opt/rincon-pos`:

```bash
sudo cp infra/systemd/rincon-pos-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rincon-pos-api
sudo systemctl status rincon-pos-api
```

Si se utiliza Docker Compose, el servicio configura
`HOST=0.0.0.0` dentro del contenedor, pero publica el puerto únicamente sobre `127.0.0.1` del VPS.

Incluir `infra/nginx/grupolosnietos-pos.conf` dentro del bloque HTTPS ya existente para el dominio. La configuración
no modifica ni reserva el puerto 3001. Después validar y recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://grupolosnietos.com.ar/pos/api/health
curl -I https://grupolosnietos.com.ar/pos/
curl -I https://grupolosnietos.com.ar/pos/sw.js
```

La redirección `/pos` → `/pos/` es necesaria para que las URLs relativas, el alcance del Service Worker y el
manifest funcionen de forma consistente. Nginx devuelve la SPA para rutas como `/pos/products`, mientras
`/pos/api/*` se envía a NestJS. TLS debe permanecer administrado por la configuración principal del dominio.
