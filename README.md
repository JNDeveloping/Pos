# El Rincón de los Nietos — Etapa 1

Monorepo funcional para la administración central multiempresa y multisucursal. Esta entrega contiene exclusivamente el núcleo solicitado: identidad/RBAC, empresa, sucursales, usuarios, categorías, marcas, productos, códigos de barra, precios/costos por sucursal e historiales automáticos. Incluye PWA e infraestructura offline de catálogos, pero **no incluye ventas, caja ni stock operativo**.

## Estructura

```text
apps/api/       NestJS, Prisma, PostgreSQL y Redis
apps/admin/     React, Vite, Tailwind, Service Worker y Dexie
packages/shared/ contratos futuros, sin abstracciones prematuras
infra/          Docker y scripts seguros de backup/restore
docs/           arquitectura y decisiones
```

## Requisitos y variables

- Node.js 22+, npm 11+, PostgreSQL 16 y Redis 7; o Docker Compose.
- Copiar `.env.example` a `.env`. `SEED_ADMIN_PASSWORD` es obligatoria, debe tener 10 caracteres o más y no tiene valor seguro para producción.
- Los secretos JWT deben ser distintos y tener al menos 32 caracteres.

## Instalación local

```bash
cp .env.example .env
npm install
# Con Docker disponible:
docker compose up -d postgres redis
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run dev:api
# otra terminal
npm run dev:admin
```

El admin abre en `http://localhost:5173/pos/`; Swagger está en `http://localhost:3002/api/docs` fuera de producción. El usuario inicial es `admin` y la contraseña es exactamente el valor configurado en `SEED_ADMIN_PASSWORD`.

Para validar el flujo PWA real se debe compilar y servir el resultado (los Service Workers requieren build):

```bash
npm run build -w @rincon/admin
npm run preview -w @rincon/admin -- --host 0.0.0.0
npm run test:offline -w @rincon/admin
```

## Calidad

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

## Endpoints principales

- Autenticación: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Dashboard: `GET /api/dashboard/summary`.
- Sucursales: CRUD lógico en `/api/branches`.
- Usuarios: CRUD lógico en `/api/users`; roles y permisos en `/api/roles`.
- Categorías y marcas: CRUD lógico en `/api/categories` y `/api/brands`.
- Productos: CRUD y filtros paginados en `/api/products`.
- Códigos: `GET|POST /api/products/:id/barcodes` y `DELETE /api/products/:id/barcodes/:barcodeId`.
- Configuración: `GET /api/products/:id/branches` y `PATCH /api/products/:id/branches/:branchId`.
- Historiales: `GET /api/products/:id/price-history` y `GET /api/products/:id/cost-history`.

Los precios, costos y márgenes se recalculan en backend dentro de una transacción. Cambiar precio o costo de una configuración existente crea su historial con usuario, producto y sucursal. Los borrados de maestros son lógicos.

## Base de datos y producción

La migración inicial versionada se encuentra en `apps/api/prisma/migrations`. Desarrollo nuevo usa `npm run db:migrate`; despliegues usan `npm run db:deploy`. PostgreSQL persiste dinero como `Decimal` y fechas UTC; la UI presenta ARS y la empresa usa `America/Argentina/Buenos_Aires`.

`docker-compose.yml` ofrece PostgreSQL, Redis y API con volúmenes persistentes. Para VPS se deben reemplazar secretos, usar TLS/Nginx, no publicar las bases, ejecutar migraciones antes del arranque y automatizar backups.

El despliegue solicitado utiliza `https://grupolosnietos.com.ar/pos/`, proxy de API en `/pos/api` y el puerto interno
3002, sin interferir con el servicio existente en 3001. La guía está en
[`docs/DESPLIEGUE_DOMINIO.md`](docs/DESPLIEGUE_DOMINIO.md) e incluye snippets para
[`Nginx`](infra/nginx/grupolosnietos-pos.conf) y
[`Apache VirtualHost`](infra/apache/grupolosnietos-pos.conf).

Para mantener NestJS ejecutándose después de cerrar SSH y reiniciarlo automáticamente ante fallos o reinicios del
VPS, instalar la unidad [`rincon-pos-api.service`](infra/systemd/rincon-pos-api.service). Los comandos completos de
instalación, logs y actualización están en la sección **API permanente como servicio systemd** de la guía de
despliegue.

## PWA y funcionamiento offline

Tras el primer login online, `SyncService` descarga el catálogo a IndexedDB. El shell abre sin red mediante Service Worker y las pantallas preparadas leen datos locales. Configuración muestra Device ID, vínculo de sucursal, uso local y reconstrucción segura. Los endpoints son `GET /api/health`, `GET /api/sync/changes?cursor=...&branchId=...` y `POST /api/sync/operations`. La estrategia detallada está en `docs/OFFLINE_FIRST.md`.
