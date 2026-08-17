# Mensaje 6 — POS, ventas y pagos

El POS online vive en `/pos/` (raíz de la PWA desplegada bajo `/pos`) y no utiliza el layout administrativo. El backend vuelve a resolver precios, descuentos, costos y stock dentro de una transacción serializable; el frontend no es autoridad para los totales.

## Operación

- `GET /pos/products` resuelve barcode, código o texto y devuelve únicamente productos habilitados en la sucursal.
- `POST /sales` completa una venta idempotente por `operationId`, crea snapshots, pagos y movimientos `SALE`.
- `GET /sales` y `GET /sales/:id` consultan ventas sin exponer rentabilidad a usuarios sin `costs.view`.
- `POST /sales/:id/cancel` conserva la venta y pagos y reintegra stock con `SALE_RETURN`.
- `POST /sales/:id/returns` admite devolución parcial, evita exceder lo vendido y permite decidir si vuelve al stock.
- `POST /sales/:id/reprint` registra la reimpresión en auditoría.
- `GET|POST|PATCH /payment-methods` y `/terminals` administran la configuración del POS.

La migración crea `Sale`, `SaleItem`, `Payment`, `PaymentMethod`, `Terminal`, `SaleReturn` y `SaleReturnItem`. El seed agrega Caja 1 y métodos efectivo, débito, crédito, Mercado Pago, transferencia y otro sin borrar personalizaciones existentes.

## Pendientes reales

La suspensión/recuperación persistente de carritos, autorización mediante credenciales de un segundo usuario, selector de listas de precio en la UI y reportes avanzados quedan pendientes. La impresión usa el navegador y CSS de 80 mm; no se integró hardware fiscal ni caja, cierres o arqueos.
