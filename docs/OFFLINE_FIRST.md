# Arquitectura PWA offline-first

## Responsabilidades

1. **Shell PWA:** Workbox precachea únicamente HTML, JS, CSS, iconos y fuentes. Ninguna respuesta `/api` entra en Cache Storage.
2. **Datos operativos:** Dexie administra IndexedDB mediante repositorios; los componentes no usan IndexedDB nativo.
3. **Operaciones:** `syncQueue` conserva comandos con `operationId` UUID. El servidor persiste la clave única antes de responder, por lo que un reintento devuelve `ALREADY_PROCESSED`.
4. **Sincronización:** `SyncService` es el único orquestador. Confirma servidor, envía la cola, obtiene cambios por cursor monotónico y confirma el cursor sólo después de la transacción local.
5. **Conectividad:** `ConnectivityService` combina eventos del navegador con `GET /api/health`, timeout y sondeo periódico.

## Modelo de consistencia

PostgreSQL es la fuente definitiva. Triggers de PostgreSQL registran cada mutación de empresa, sucursal, categoría, marca, producto, barcode y `BranchProduct` en `SyncChange`. Su `BIGSERIAL` es el cursor total ordenado; evita depender de relojes. Los dispositivos solicitan eventos posteriores a su cursor y, si están vinculados, sólo configuraciones de su sucursal. Las bajas lógicas generan `DELETE`.

Para maestros administrativos manda el servidor: el dispositivo reemplaza su copia con el evento más reciente. Las futuras ventas serán comandos inmutables nacidos localmente; nunca se resolverán descartando el comando. Un handler transaccional e idempotente deberá aceptarlas o devolver un conflicto explícito para intervención.

## Sesión y secretos

Access y refresh tokens viven en `sessionStorage`, no en IndexedDB ni almacenamiento persistente. Después de un login online se guarda sólo un perfil/alcance firmado implícitamente por la sesión previa, sin contraseña ni hash, con vencimiento local de 12 horas. Esa sesión offline es limitada a datos ya descargados. El primer acceso al dispositivo siempre necesita Internet. En una fase futura puede migrarse el refresh a cookie HttpOnly; no se simula protección criptográfica que el navegador no puede garantizar por sí solo.

## Recuperación y actualizaciones

“Reconstruir datos locales” elimina sólo catálogos descargables, conserva `syncQueue` y vuelve a pedir el cursor desde cero. Las actualizaciones del Service Worker usan modo `prompt`: nunca activan una versión nueva silenciosamente en medio de una operación. Background Sync podrá despertar la cola como mejora, pero la sincronización principal funciona con la aplicación abierta.

IndexedDB es caché operativo, no backup. Los backups se realizan con `infra/scripts/backup-postgres.sh` y se restauran con `infra/scripts/restore-postgres.sh` sobre PostgreSQL.
