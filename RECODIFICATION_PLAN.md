# Plan maestro de recodificación

**Fecha de corte:** 8 de septiembre de 2026  
**Fuente de verdad:** código ejecutable, esquema Prisma y migraciones; `PROJECT_STATUS.md` resume el resultado.

## 1. Regla de avance

Las fases son puertas de calidad, no una lista de pantallas. Una fase no se cierra hasta que sus recorridos tienen backend,
permisos, aislamiento por empresa/sucursal, auditoría, errores comprensibles y pruebas sobre PostgreSQL real.

Estados usados:

- **DONE:** probado de punta a punta contra infraestructura real.
- **PARTIAL:** existe código funcional o cobertura unitaria, pero falta una capa o certificación real.
- **BLOCKED:** no se puede validar en el entorno actual por una dependencia externa concreta.
- **NOT_STARTED:** el dominio o flujo todavía no existe.

## 2. Auditoría y clasificación

| Área                 | Dominio/backend                                                               | UI/experiencia                                                              | Decisión                          | Estado      |
| -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------- | ----------- |
| Autenticación y RBAC | JWT, refresh, `tokenVersion`, guard global y bypass de SUPER_ADMIN            | Login y rutas protegidas                                                    | KEEP                              | PARTIAL     |
| Empresa/sucursal     | Tenant y alcance por `companyId`/`branchId`                                   | Selector por pestaña                                                        | KEEP + REFACTOR por endpoint      | PARTIAL     |
| Productos            | CRUD, barcodes, proveedor, sucursal, import/export, historial                 | Lista amplia y editor extenso                                               | KEEP backend / REBUILD UX         | PARTIAL     |
| Pricing              | `PriceCalculationService`, Decimal, herencia y redondeo                       | Configuración y cotización existentes                                       | KEEP                              | PARTIAL     |
| POS                  | Venta transaccional e idempotente                                             | Scanner, carrito, pesables, venta rápida y cobro                            | KEEP dominio / REFACTOR UX        | PARTIAL     |
| Caja                 | Terminal, sesión, movimientos y cierre                                        | Apertura y arqueo dentro del POS                                            | KEEP dominio / REFACTOR UX        | PARTIAL     |
| Compras              | Orden, compra, recepción, costo y stock                                       | Alta/detalle funcionales; revisión de precio incompleta                     | KEEP dominio / REBUILD UX         | PARTIAL     |
| Proveedores          | CRUD lógico y `SupplierProduct`                                               | Lista y ficha básicas                                                       | KEEP / REFACTOR                   | PARTIAL     |
| Stock                | Servicio central, movimientos, ubicaciones, inventario, merma y transferencia | Stock operativo; auxiliares técnicos                                        | KEEP dominio / REBUILD auxiliares | PARTIAL     |
| Etiquetas            | Cola persistida                                                               | Fleje, FyV y A5 mediante navegador                                          | KEEP / REFACTOR impresión         | PARTIAL     |
| Caja en vivo         | Socket.IO y cronología persistida                                             | Monitor disponible                                                          | KEEP / REFACTOR escalabilidad     | PARTIAL     |
| Administración móvil | Reutiliza APIs de productos, pricing y stock                                  | Flujo responsive de escaneo                                                 | KEEP / REFACTOR                   | PARTIAL     |
| Clientes             | No hay modelo ni mayor completo                                               | No hay superficie operativa                                                 | REBUILD                           | NOT_STARTED |
| Cuenta corriente     | Sólo existe naturaleza de medio `ACCOUNT`                                     | Sin cliente, límite ni estado de cuenta                                     | REBUILD                           | NOT_STARTED |
| Reportes             | Dashboard y ventas aportan datos parciales                                    | No hay panel analítico completo                                             | REBUILD                           | NOT_STARTED |
| Alertas programadas  | No hay reglas persistidas ni ejecutor                                         | No existe UI                                                                | REBUILD                           | NOT_STARTED |
| Impresión nativa     | No existe adaptador de dispositivo                                            | `window.print()`                                                            | REBUILD futuro                    | NOT_STARTED |
| Local+nube           | API/PostgreSQL central únicos                                                 | No se simula estado local                                                   | KEEP estado real                  | NOT_STARTED |
| Componentes legados  | APIs aún consumibles                                                          | Commerce, PriceLists, Roles, Órdenes y StockOperations duplican superficies | REMOVE tras paridad               | PARTIAL     |

## 3. Fase 0 — auditoría, staging y migraciones

### Trabajo documental completado

- Inventario de dominios, rutas, controladores, permisos, modelos y 24 migraciones.
- Separación entre funcionalidad con tests unitarios y funcionalidad certificada.
- Matriz de recorridos en `E2E_VALIDATION.md`.
- Registro incremental en `CHANGELOG_RECODIFICATION.md`.

### Puerta pendiente

1. Levantar PostgreSQL 16 y Redis 7 con `docker compose` o servicios equivalentes.
2. Generar Prisma y ejecutar `prisma migrate deploy` desde una base vacía.
3. Ejecutar seed y sincronización idempotente de permisos.
4. Arrancar API y validar `/api/health`.
5. Ejecutar los cuatro recorridos E2E con datos aislados.
6. Repetir migraciones sobre una copia anonimizada representativa.

**Bloqueo actual:** el contenedor de trabajo no incluye `docker`, `psql` ni credenciales de una base de staging. Por esa
razón ninguna fase se eleva a DONE.

## 4. Fase 1 — POS, Productos, Pricing y Caja

### Backend a conservar

- `PriceCalculationService` y uso de `Prisma.Decimal`.
- `Product` maestro y `BranchProduct` por sucursal.
- venta serializable con `operationId`, snapshots, pagos, stock y auditoría.
- `Terminal`, `CashSession`, `CashMovement` y protección de sesión única.

### Trabajo requerido

1. Crear pruebas HTTP de producto, reglas heredadas y precio final consumido por POS.
2. Probar doble venta concurrente y stock insuficiente real.
3. Certificar en PostgreSQL la persistencia y recuperación concurrente de ventas suspendidas ya incorporada.
4. Incorporar cliente sólo después de existir el dominio de Fase 3; hasta entonces mostrar Consumidor Final sin deuda falsa.
5. Completar recargo como regla de venta separada y auditable si se aprueba su semántica.
6. Separar visualmente caja actual/historial sin duplicar `CashService`.

### Criterio de salida

Alta de producto → costo/margen/redondeo → stock inicial → apertura → scanner → pago mixto/efectivo → stock/caja →
ticket/reimpresión → cierre, todo comprobado en PostgreSQL.

## 5. Fase 2 — Compras, Proveedores, Stock e inventario

1. Reconstruir Ingreso de mercadería sobre las APIs actuales y agregar estado DRAFT persistido.
2. Mostrar cotización backend por línea y registrar la decisión de precio al confirmar.
3. Unificar Historial/Órdenes/Proveedores como pestañas de Compras, manteniendo redirects.
4. Agregar rotación y sugerencias sólo con consultas agregadas e índices medidos.
5. Completar estados REQUESTED/PREPARING/IN_TRANSIT/RECEIVED/CANCELLED sin alterar migraciones desplegadas.
6. Rehacer inventario, merma y vencimiento sobre `StockService`; nunca escribir cantidades desde controladores/UI.

## 6. Fase 3 — Clientes y cuenta corriente

Crear como dominio transaccional nuevo:

- `Customer` por empresa, código, documento, contacto, límite y baja lógica.
- mayor inmutable con SALE, PAYMENT, CREDIT_NOTE, ADJUSTMENT y RETURN.
- venta a cuenta vinculada a cliente y validada contra límite.
- pago de cliente que cree movimiento de cuenta, impacto de caja y auditoría en una transacción.
- estado de cuenta imprimible/exportable derivado del mayor.

Hasta completar esta fase, `ACCOUNT` debe describirse como pago referenciado, no como cuenta corriente certificada.

## 7. Fases 4 a 6

- **Fase 4:** reportes server-side, auditoría humana, Caja en vivo multi-instancia y mensajes persistidos.
- **Fase 5:** vencimientos comerciales, alertas programadas, etiquetas e interfaz `PrintingService` sin fingir hardware.
- **Fase 6:** móvil, carga/performance con 50.000 productos, lazy loading y eliminación segura de componentes legados.

## 8. Reglas de implementación

- Una operación comercial crítica debe ser atómica e idempotente donde corresponda.
- Todo query respeta empresa y, para operaciones, sucursal/acceso del usuario.
- Backend recalcula precio, stock, descuentos, totales, deuda e impacto de caja.
- No editar migraciones desplegadas ni usar `db push` como entrega.
- No crear botones hasta disponer de endpoint, permiso, estados y prueba.
- No remover legacy hasta verificar rutas, imports, paridad y build.
- No marcar DONE sin evidencia registrada en `E2E_VALIDATION.md`.
