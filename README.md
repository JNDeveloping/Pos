# El Rincón de los Nietos · Plataforma POS

Base funcional de la **etapa 1** de una plataforma multiempresa/multisucursal para Argentina. Incluye API NestJS, PostgreSQL/Prisma, autenticación JWT con renovación, RBAC configurable, empresa, tres sucursales, usuarios y catálogo con precio por sucursal; además de un panel React en español.

La arquitectura completa, sus límites y el plan incremental están documentados en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). No se incluyeron ventas, cajas ni sincronización offline: pertenecen a las etapas 2 y 3 y se construirán sobre este núcleo validado.

## Requisitos
- Node.js 22+
- npm 11+
- Docker con Compose (recomendado), o PostgreSQL 16 y Redis 7

## Inicio local
```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev:api
# En otra terminal:
npm run dev:admin
```

Abrir `http://localhost:5173`. El seed crea `admin`; su contraseña toma `SEED_ADMIN_PASSWORD` (por defecto local: `Cambiar123!`). Debe cambiarse fuera de desarrollo.

## Comandos
| Comando | Uso |
|---|---|
| `npm run build` | Compila API y administración |
| `npm run typecheck` | Verifica TypeScript en todo el workspace |
| `npm test` | Ejecuta las pruebas disponibles |
| `npm run db:push` | Sincroniza el esquema durante desarrollo |
| `npm run db:seed` | Carga datos iniciales de manera repetible |

En producción se deben generar y revisar migraciones versionadas con `prisma migrate deploy`; `db push` sólo se propone para el arranque de desarrollo. La API expone salud en `GET /api/health` y sus rutas iniciales autenticadas son `/api/company`, `/api/branches`, `/api/users`, `/api/categories` y `/api/products`.

## Seguridad y datos
- Copiar `.env.example`; nunca versionar `.env`.
- Usar secretos JWT diferentes de al menos 32 caracteres.
- Las contraseñas y refresh tokens se guardan con Argon2.
- El backend deriva empresa/sucursal/permisos del JWT y no acepta un tenant arbitrario del navegador.
- Importes persistidos usan `Decimal`; las fechas se guardan en UTC.

## Docker y despliegue
`docker compose up --build` levanta PostgreSQL, Redis y la API. Antes de un despliegue en Ubuntu/VPS: usar secretos externos, TLS en Nginx, ejecutar migraciones, limitar puertos de datos a la red privada y configurar backups con `pg_dump`/`pg_restore`. Redis queda preparado como dependencia de infraestructura; se conectará a colas y caché al introducir casos de uso que lo necesiten, evitando código sin función en esta etapa.
