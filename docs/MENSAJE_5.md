# Mensaje 5 — Stock

El stock se registra por sucursal y producto en `Stock`; `availableQuantity` se calcula como físico menos reservado. Toda variación física pasa por `StockService` y crea un `StockMovement` dentro de la misma transacción serializable. La compra confirmada usa `totalUnits` y la referencia única `PURCHASE` para que el ingreso sea idempotente.

## API

- `GET /stock`, `GET /stock/movements`, `POST /stock/adjust`.
- `GET|POST /inventories`, `GET /inventories/:id`, `PATCH /inventories/:id/items/:itemId`, `POST /inventories/:id/confirm`.
- `GET|POST /waste` y `GET /stock/expirations`.
- `GET|POST /transfers`, `POST /transfers/:id/send`, `POST /transfers/:id/receive`.

Inventarios no alteran existencias durante el conteo. La confirmación genera un movimiento por diferencia. Las transferencias descuentan en origen al enviar, registran tránsito en destino y crean el ingreso al recibir, incluso parcialmente.

## Alcance y pendientes reales

La versión incluye operación manual, historial paginado, lotes opcionales, vencimientos, mermas, transferencias e integración de compras. La importación CSV/XLSX de stock inicial y las exportaciones se mantienen como evolución de interfaz; la API de carga inicial ya usa el modo `INITIAL` del ajuste. FEFO, reservas de ventas y `SALE` quedan deliberadamente preparados, no implementados, para etapas posteriores.
