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

Si el repositorio completo ya está instalado en `/var/www/grupolosnietos/pos`, Apache puede publicar directamente
`/var/www/grupolosnietos/pos/apps/admin/dist` y no es necesario copiar el build a otra carpeta.

## API permanente como servicio systemd

La API debe ejecutarse con systemd en el puerto 3002; no se debe dejar abierta mediante `npm run dev`, `screen` o
una terminal SSH. La unidad incluida usa el repositorio que ya está en `/var/www/grupolosnietos/pos` y carga las
variables desde `/var/www/grupolosnietos/pos/.env`.

Primero preparar una versión de producción y comprobar dónde está Node:

```bash
cd /var/www/grupolosnietos/pos
command -v node
npm ci
npm run prisma:generate
npm run db:deploy
npm run build
sudo chown root:www-data .env
sudo chmod 640 .env
chmod +x infra/scripts/check-api-service.sh
sudo chmod -R a+rX apps/api/dist node_modules
```

La unidad busca `node` en `/usr/local/bin`, `/usr/bin` y `/bin`. Si `command -v node` devuelve otra ruta —por ejemplo,
una instalación privada de NVM— conviene instalar Node 22 globalmente para el servidor o agregar esa ruta al `PATH`
de la unidad. No se utiliza `npm start` dentro del servicio: systemd ejecuta directamente el JavaScript compilado y
las variables ya provienen de `EnvironmentFile`.

Instalar y arrancar el servicio:

```bash
sudo cp infra/systemd/rincon-pos-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rincon-pos-api
sudo systemctl status rincon-pos-api
```

`enable` hace que arranque automáticamente después de reiniciar el VPS. `Restart=on-failure` lo reinicia si Node
termina por un error, pero permite detenerlo deliberadamente con `systemctl stop`.

Ver logs y comprobar salud:

```bash
sudo journalctl -u rincon-pos-api -f
curl -fsS http://127.0.0.1:3002/api/health
curl -fsS https://grupolosnietos.com.ar/pos/api/health
```

Para publicar una actualización:

```bash
cd /var/www/grupolosnietos/pos
git pull
npm ci
npm run prisma:generate
npm run db:deploy
npm run build
sudo systemctl restart rincon-pos-api
sudo systemctl status rincon-pos-api --no-pager
```

Si el servicio no inicia, obtener el motivo sin ocultarlo:

```bash
sudo systemctl reset-failed rincon-pos-api
sudo journalctl -u rincon-pos-api -n 100 --no-pager
```

### `Failed to load environment files` / resultado `resources`

Ese mensaje aparece antes de iniciar Node y normalmente significa que el `.env` configurado en la unidad no existe,
no es legible o la unidad instalada todavía apunta a otra ruta. `.env` no se descarga con `git pull` porque está
ignorado deliberadamente; debe crearse en cada servidor.

Ejecutar estas comprobaciones en el VPS:

```bash
sudo systemctl cat rincon-pos-api
sudo ls -la /var/www/grupolosnietos/pos/.env
sudo -u www-data test -r /var/www/grupolosnietos/pos/.env && echo "env legible"
sudo -u www-data /var/www/grupolosnietos/pos/infra/scripts/check-api-service.sh
```

Si el archivo no existe:

```bash
cd /var/www/grupolosnietos/pos
sudo cp .env.example .env
sudo nano .env
sudo chown root:www-data .env
sudo chmod 640 .env
```

No dejar los secretos de ejemplo: configurar `DATABASE_URL`, `REDIS_URL`, dos secretos JWT diferentes y robustos,
`PORT=3002`, `HOST=127.0.0.1` y `CORS_ORIGIN=https://grupolosnietos.com.ar`.

Finalmente reinstalar la unidad actualizada —editar solamente el archivo del repositorio no modifica la copia de
`/etc/systemd/system`— y arrancar:

```bash
cd /var/www/grupolosnietos/pos
chmod +x infra/scripts/check-api-service.sh
sudo cp infra/systemd/rincon-pos-api.service /etc/systemd/system/rincon-pos-api.service
sudo systemctl daemon-reload
sudo systemctl reset-failed rincon-pos-api
sudo systemctl restart rincon-pos-api
sudo systemctl status rincon-pos-api --no-pager -l
sudo journalctl -u rincon-pos-api -n 100 --no-pager -o cat
```

La unidad marca `EnvironmentFile` como opcional sólo durante el parseo para que el preflight pueda imprimir el
motivo preciso. El script sigue rechazando el arranque si `.env` falta, no es legible o no contiene variables
obligatorias; no se inicia la API con una configuración incompleta.

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

## Apache VirtualHost

Si el dominio utiliza Apache, **no se debe cambiar el `DocumentRoot` del VirtualHost existente**. La URL `/pos/` se
monta mediante `Alias` sobre el directorio compilado. Por lo tanto, esta ruta es correcta:

```apache
Alias /pos/ /var/www/grupolosnietos/pos/apps/admin/dist/

<Directory /var/www/grupolosnietos/pos/apps/admin/dist>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
```

El `<Directory>` no debe apuntar a `src`, al repositorio completo ni a `/var/www/grupolosnietos/pos`: Apache debe
servir los archivos finales de `dist`. El snippet completo `infra/apache/grupolosnietos-pos.conf` añade también el
proxy de `/pos/api/` al puerto 3002, el fallback de React, la redirección `/pos` → `/pos/` y las cabeceras PWA.

Habilitar los módulos, incluir el snippet dentro del VirtualHost HTTPS y validar:

```bash
sudo a2enmod alias proxy proxy_http proxy_wstunnel rewrite headers
sudo apachectl configtest
sudo systemctl reload apache2
```

Comprobar además el handshake de Socket.IO. La respuesta debe comenzar con `0{` y
no debe ser HTML ni devolver 404/502:

```bash
curl -i 'https://grupolosnietos.com.ar/pos/api/socket.io/?EIO=4&transport=polling'
```

Ejemplo:

```apache
<VirtualHost *:443>
    ServerName grupolosnietos.com.ar
    # Mantener aquí el DocumentRoot actual del resto del sitio.
    Include /var/www/grupolosnietos/pos/infra/apache/grupolosnietos-pos.conf
</VirtualHost>
```

### Error `Unexpected token '<'`

Ese error no proviene de las credenciales. Significa que el navegador pidió `/pos/api/auth/login`, pero Apache
respondió `index.html` (`<!doctype html>`) en lugar del JSON de NestJS. Sucede cuando falta `ProxyPass`, el snippet no
está incluido en el VirtualHost HTTPS, `mod_proxy_http` no está habilitado o la API no está escuchando en 3002.

Comprobar primero el backend directamente desde el VPS:

```bash
curl -i http://127.0.0.1:3002/api/health
```

Debe responder `Content-Type: application/json` y un cuerpo con `"status":"ok"`. Después comprobar el mismo recurso
a través de Apache:

```bash
curl -i https://grupolosnietos.com.ar/pos/api/health
```

Si la segunda respuesta comienza con `<!doctype html>`, Apache está enviando la petición al fallback React. Revisar
que las directivas `ProxyPass` del snippet estén dentro del VirtualHost `*:443`, ejecutar `apachectl configtest` y
recargar Apache. El fallback incluye además una exclusión explícita para `/pos/api`, de modo que nunca debería
convertir un error real de la API en HTML.
