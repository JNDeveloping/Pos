# Continuidad futura por servidor local

Durante el desarrollo el sistema opera **100% online**: React consume la API NestJS y PostgreSQL central es la única fuente de verdad. La PWA sólo aporta instalación y caché del shell; no guarda datos comerciales ni respuestas de `/api/`.

Se retiraron IndexedDB, `SyncService`, la outbox del navegador, los cursores y los endpoints `/sync`. Esto evita que varias pestañas compitan por sincronizar y elimina estados locales divergentes.

La continuidad definitiva se implementará al finalizar el producto mediante una API y PostgreSQL locales en cada sucursal. Ese servidor local sincronizará con la nube. El dominio conserva UUID, `companyId`, `branchId`, timestamps UTC, soft delete, históricos y límites transaccionales para no cerrar esa posibilidad.
