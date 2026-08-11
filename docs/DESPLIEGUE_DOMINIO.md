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
sudo a2enmod alias proxy proxy_http rewrite headers
sudo apachectl configtest
sudo systemctl reload apache2
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
