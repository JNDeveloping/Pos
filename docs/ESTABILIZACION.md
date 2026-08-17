# Estabilización online

## Causa del titileo

La inicialización global arrancaba `SyncService` en cada montaje y el servicio cambiaba el mismo estado de conectividad que observaba para decidir cuándo volver a sincronizar. Cada pestaña añadía sus propios listeners y locks, produciendo ciclos de estado, refrescos remotos y loaders repetidos.

El motor offline del navegador fue retirado por decisión de arquitectura. La aplicación inicia autenticación y sucursales una sola vez. El servicio de conectividad es idempotente, mantiene un único sondeo en vuelo y usa intervalos de 60 segundos en estado estable y 20 segundos durante una caída. Nunca recarga la página ni cierra sesión por errores de red.

## Estado temporal

Los módulos consultan exclusivamente la API. El Service Worker conserva sólo assets bajo `/pos/`, utiliza actualización bajo confirmación y no cachea `/api/`. La futura continuidad se implementará con una API y PostgreSQL locales por sucursal.
