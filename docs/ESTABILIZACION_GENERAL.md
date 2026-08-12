# Estabilización general

La auditoría encontró fallas de integración que no eran visibles en los tests unitarios: filtros booleanos opcionales convertían parámetros ausentes a `false` y ocultaban productos activos; el alta de producto se repartía entre tres requests no atómicos; el POS ignoraba la lista predeterminada y no diferenciaba producto deshabilitado, sin precio o sin stock; Redis ausente podía terminar el proceso; stock omitía productos habilitados sin fila física; y la factura analizada no tenía conversión a compra desde la interfaz.

Las correcciones consolidan esos flujos sin añadir dominios nuevos. El alta de producto, barcode y configuración de sucursal ahora es una única transacción. El POS resuelve catálogo, barcode, configuración de sucursal, lista efectiva y stock, y mantiene la validación definitiva al completar la venta. Stock lista también existencias en cero. Inventarios toman únicamente productos habilitados. Transferencias consideran todos sus ítems antes de marcar recepción completa. La factura puede revisarse, aprender una vinculación y convertirse transaccionalmente en una compra `REVIEW`.

## Verificación real

Además de build, lint y tests, la estabilización se verificó contra PostgreSQL 16 aplicando las once migraciones, ejecutando seed y `permissions:sync` dos veces. Se probaron por HTTP: producto → sucursal → barcode → stock → búsqueda POS; venta → pago → movimiento → repetición idempotente → devolución; proveedor → compra → costo → ingreso de stock idempotente; y un usuario CAJERO con acceso al POS y respuestas 403 en roles/costos.

## Pendientes reales

Las pantallas de inventario, transferencias, mermas, métodos de pago y terminales siguen siendo funcionalmente básicas y no sustituyen una UX especializada. La autorización de descuentos con credenciales de un segundo usuario y los carritos suspendidos compartidos entre terminales no están terminados. El adaptador actual de facturas es manual si no se configura un proveedor IA/OCR. No existen aún tests HTTP automatizados aislados en una base efímera; los smoke tests anteriores se ejecutaron contra una base local descartable.
