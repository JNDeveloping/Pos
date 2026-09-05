# Estado técnico real — auditoría general 2026-09-05

## Veredicto ejecutivo

El repositorio contiene un POS/ERP existente, amplio y compilable. Producto, stock, compras y venta tienen backend real y
persistencia Prisma; no son maquetas aisladas. Aun así, **ningún recorrido comercial queda certificado de punta a punta
en esta auditoría** porque el entorno no dispone de PostgreSQL/Redis ni Docker para aplicar las 18 migraciones y ejecutar
HTTP/e2e reales. La cobertura actual protege cálculos y políticas puntuales, pero no prueba una venta concurrente completa.

El flujo más maduro es producto → configuración de sucursal → catálogo POS → carrito → cobro → venta/pagos → movimiento
de stock → ticket. La navegación y restauración de sesión ya fueron estabilizadas; los mayores riesgos pendientes son
requests tardíos dentro de páginas concretas, permisos inconsistentes en Configuración POS, alta rápida de terminal con
códigos potencialmente repetidos, fechas de reportes en UTC y ausencia de pruebas integradas sobre la base real.

## Arquitectura comprobada

- Monorepo npm workspaces con Node `>=20.19` y TypeScript 5.9.
- `apps/admin`: React 19, Vite 7, Tailwind 3, Vitest y PWA bajo `/pos/`.
- `apps/api`: NestJS 11, guard JWT/RBAC global, Prisma 6, PostgreSQL y Redis tolerante a fallos.
- API pública esperada en `/pos/api`; Nest usa `/api` y escucha internamente en `127.0.0.1:3002`.
- La PWA sólo precachea shell/assets. No hay IndexedDB, caché de respuestas API ni fuente comercial offline.
- Existen 18 migraciones inmutables. La última, `20260904170000_pos_terminal_and_line_notes`, agrega impresora/configuración
  por terminal y nota de línea de venta.
- `packages/shared` sigue reservado; los contratos frontend/backend continúan duplicados localmente.

## Mapa de datos y relaciones principales

### Identidad, tenant y configuración

- `Company` es el tenant y relaciona sucursales, usuarios, roles, permisos, productos y documentos comerciales.
- `Branch` contiene reglas comerciales, POS, ticket, descuentos y stock negativo. `UserBranchAccess` amplía el `branchId`
  principal del usuario y limita las sucursales operables.
- `CompanySetting` y `BranchSetting` guardan JSON por clave. Apariencia, modo POS y grupos se leen desde servidor;
  `UserPreference` no existe.
- `Role` ↔ `Permission` usa `RolePermission`; `User` ↔ `Role` usa `UserRole`. `SUPER_ADMIN` tiene bypass en el guard.

### Catálogo y precios

- `Product` es el maestro por empresa; se relaciona con `Category`, `Brand`, `ProductFamily`, `ProductBarcode` y proveedores.
- `BranchProduct` habilita el producto por sucursal y guarda costo, precio, margen, mínimo, favorito y reglas POS.
- `PriceHistory`/`CostHistory` conservan cambios; `PriceList`/`PriceListItem` existen, aunque su administración frontend es
  mínima y no está enlazada en la navegación principal.
- `SupplierProduct` aporta código, barcode, descripción, costo y preferencia del proveedor; `SupplierProductAlias` alimenta
  el matching de facturas y la búsqueda POS.

### Stock, compras y ventas

- `Stock` es el total por producto/sucursal. `StockLocationBalance` divide `SALE_FLOOR` y `WAREHOUSE`; el total debe coincidir
  con su suma. Toda variación relevante crea `StockMovement`.
- `StockLot`, `Inventory`, `Waste` y `StockTransfer` existen y conservan trazabilidad, pero sus UIs de escritorio siguen
  siendo básicas.
- `PurchaseOrder` y `Purchase` se relacionan con proveedor, sucursal y productos. Confirmar compra puede actualizar costo
  y recibir stock de forma transaccional/idempotente.
- `Terminal` pertenece a empresa/sucursal y se relaciona con `CashSession`. Tiene código único por sucursal, nombre,
  estado, impresora opcional, configuración JSON y secuencia de tickets.
- `CashSession` une terminal, sucursal y cajero; registra fondo, apertura y cierre. `Sale` conserva terminal, sesión, cajero,
  totales y estado. `SaleItem` guarda snapshots y nota; `Payment` guarda medio, recibido, vuelto y referencia.
- `LabelPrintQueue` enlaza producto, sucursal y usuario y mantiene cantidad/estado de etiquetas pendientes.

## Flujo POS actual, sin ambigüedades

1. `App.tsx` restaura JWT, consulta `/auth/me` y obtiene sucursales autorizadas.
2. `Pos.tsx` carga en paralelo medios de pago, bootstrap de caja, favoritos, grupos y settings de la sucursal.
3. Sin caja abierta muestra apertura con sucursal, cajero, terminal y fondo. Puede crear terminal sólo con
   `terminals.manage`; luego abre `CashSession` con `cashSessions.open` y recuerda terminal/cajero en `sessionStorage`.
4. El buscador resuelve barcode exacto o busca nombre, código interno, SKU, marca y datos/aliases de proveedor. Un segundo
   scan suma cantidad. Productos pesables abren captura de peso; precio manual depende de permiso y política del producto.
5. El carrito admite cantidad, precio autorizado, descuento, nota y eliminación. Los suspendidos funcionan, pero viven
   en `localStorage` de ese navegador y no son compartidos ni históricos comerciales.
6. Cobro toma medios activos del backend; si la empresa no tiene ninguno, el GET crea Efectivo, Débito, Crédito,
   Transferencia, Mercado Pago y Otro. Admite pago mixto, referencia, efectivo recibido y vuelto.
7. El backend revalida tenant, sucursal, terminal, caja, producto, precio, descuentos, stock y pagos. En una transacción
   serializable crea `Sale`, `SaleItem`, `Payment`, movimientos de stock y auditoría. `operationId` da idempotencia.
8. La respuesta muestra ticket térmico con imprimir/reimprimir, no imprimir y nueva venta. La impresión automática es un
   setting de sucursal y abre el diálogo del navegador; no hay impresión nativa silenciosa.

## Estado por módulo

### Funciona a nivel de código y tests unitarios

- **Autenticación/RBAC:** login, refresh, logout, revocación por `tokenVersion`, roles activos, permisos y bypass seguro.
- **Productos:** CRUD, baja lógica, paginación, búsqueda extensa, barcodes, import/export, precios/costos por sucursal,
  proveedores, historial, cámara en administración móvil y buscador desktop.
- **Stock backend:** ajustes, reposición depósito→local, movimientos, recepción, inventarios, mermas y transferencias.
- **Compras backend:** órdenes, compras, confirmación/cancelación, factura asistida y matching con revisión humana.
- **POS principal:** apertura/cierre de caja, scanner USB, grupos táctiles, pesables, carrito, descuentos, pagos mixtos,
  vuelto, venta idempotente/transaccional, cancelación, devolución y ticket.
- **Usuarios:** alta, edición, contraseña, roles, sucursales, activación y baja lógica con protección de `SUPER_ADMIN`.
- **Auditoría:** consulta paginada multi-tenant y registro de operaciones sensibles.

### Parcial, frágil o no certificado

- **Dashboard/reportes:** datos reales y monitor multi-sucursal; los límites hoy/ayer usan zona del proceso y pueden cortar
  mal en producción UTC en vez de `America/Argentina/Buenos_Aires`.
- **Categorías/familias:** categorías tienen CRUD jerárquico. `ProductFamily` tiene modelo/API y aparece en listados, pero
  no existe gestión/asignación completa desde el frontend.
- **Stock escritorio:** no expone reposición local aunque API y móvil sí; operaciones secundarias muestran JSON técnico.
- **Vencimientos:** consulta y lotes existen, pero falta una UX comercial con riesgo, valor, filtros y edición desde ficha.
- **Compras frontend:** las altas cargan sólo los primeros 100 productos; sin búsqueda remota no escalan al catálogo real.
- **Proveedores:** ficha y relaciones funcionan; cuenta corriente no existe y permanece fuera del alcance aprobado.
- **Etiquetas:** Fleje, Cartel FyV y A5 Liqui imprimen con composición física; falta calibración por impresora y marcar como
  impresa sigue siendo una acción separada del diálogo del navegador.
- **Terminales:** esquema, CRUD y apertura rápida existen. `posConfig` se persiste pero no tiene editor específico; la UI
  genera `CAJA-${terminalesActivas + 1}`, que puede chocar con el índice único si hay terminales inactivas.
- **Medios de pago:** existen y se autoinicializan. El endpoint de lectura requiere `sales.access`; Configuración lo llama
  sin ocultar la sección por ese permiso, por lo que ciertos roles con `branches.settings` pueden recibir 403.
- **Suspendidos:** funcionan sólo en el dispositivo. No hay modelo/API, concurrencia, recuperación multi-terminal ni
  auditoría; no deben considerarse una venta `SUSPENDED` persistida pese a existir ese enum.
- **Configuración:** settings de sucursal y grupos están en backend, pero `PosSettingsPage.tsx` legado todavía guarda otra
  configuración local y puede divergir de `Settings.tsx`.

### Ausente

- Promociones temporales/2x1/3x2/segunda unidad y liquidaciones como regla comercial persistida.
- Compras recomendadas, FEFO, OCR/LLM productivo, cuenta corriente de proveedor y hardware fiscal.
- Suite HTTP/e2e con PostgreSQL, pruebas de migración y pruebas de concurrencia de venta/stock/caja.
- Impresión nativa directa, arqueo contable y retiros de caja.

## Errores y comportamientos problemáticos detectados

### Prioridad alta

1. **Requests tardíos dentro de una misma sucursal:** cambiar de sucursal ahora remonta el contenido y evita conservar su
   estado anterior. Aun así, algunas búsquedas lanzan requests sin cancelación y una respuesta antigua puede reemplazar
   una búsqueda más reciente dentro de la misma pantalla.
2. **Permisos de Configuración POS:** terminales y medios se renderizan desde una ruta autorizada por `branches.settings`,
   pero las APIs exigen además `terminals.view/manage` y `sales.access/paymentMethods.manage`. La UI no filtra todas esas
   acciones; el resultado puede ser 403, promesa rechazada o controles visibles que luego fallan.
3. **Código de terminal rápido:** se calcula con la cantidad de terminales activas cargadas. Una terminal inactiva con el
   mismo código provoca violación de unicidad y un mensaje poco orientativo.
4. **Sin prueba real de la última migración:** schema y SQL son coherentes y Prisma valida, pero no se aplicó la migración
   sobre una copia PostgreSQL ni se probó rollback/compatibilidad de despliegue.

### Prioridad media

5. **Búsquedas y feedback:** búsquedas POS menores de dos caracteres fallan por diseño; varias pantallas no cancelan
   requests previos ni exponen siempre loading/error. El scanner desktop de Productos deja el modal abierto si la cámara
   falla, mientras el mensaje queda detrás del backdrop.
6. **Cobertura de rutas:** la navegación interna y los redirects legados ya usan History API sin recargar el documento ni
   mutar historial durante render. Las rutas desconocidas muestran una salida 404 clara en lugar de caer silenciosamente
   en Dashboard; falta una prueba e2e que recorra todos los enlaces visibles por cada combinación de permisos.
7. **Inicialización POS acoplada:** un `Promise.all` carga caja, pagos, catálogo y settings. Si falla una sola API, toda la
   preparación se marca offline y puede ocultar datos que sí estaban disponibles.
8. **Configuración duplicada:** `Settings.tsx` es la autoridad servidor; `PosSettingsPage.tsx` y helpers locales son legado.
9. **Listados no escalables:** compras/órdenes usan un lote fijo de 100 productos; ventas administrativas toman hasta 100;
   varias operaciones de stock no tienen UI paginada útil.
10. **Calidad de contratos:** abundan `any`, tipos frontend duplicados y módulos Nest de cientos de líneas; compilan, pero
    aumentan el riesgo de que un cambio de DTO rompa la UI sin test HTTP/contrato.

## Duplicado, legado o sin uso claro

- Rutas/componentes de Precios, Costos, Roles, Órdenes, Inventarios, Movimientos y Transferencias siguen compilados aunque
  las rutas principales redirigen a Productos, Usuarios, Compras o Stock.
- Alias `/products`/`/admin/products`, `/suppliers`/`/admin/suppliers` y otros conservan compatibilidad pero duplican mapa.
- `PriceLists` y endpoints existen sin navegación principal; `PriceListItem` carece de gestión completa.
- `PosSettingsPage.tsx`, `loadPosSettings` y `savePosSettings` son una segunda fuente local frente a settings servidor.
- Búsqueda global y campana del layout son decorativas.
- `SaleStatus.SUSPENDED` existe, pero los suspendidos actuales no usan `Sale` ni PostgreSQL.

## Dependencias entre módulos

- **POS** depende de Auth/RBAC → acceso de sucursal → Terminal/CashSession → Product/BranchProduct/PriceList → Stock →
  PaymentMethod → Sale/Payment/Audit → Ticket.
- **Compras** depende de Supplier/SupplierProduct → Product/BranchProduct → CostHistory → Stock/StockLot → Audit.
- **Productos** alimenta Stock, Compras, POS, Etiquetas y Dashboard; cambios de identidad no deben romper snapshots.
- **Dashboard** depende de ventas, pagos, stock, lotes y sesiones de caja, y debe filtrar tenant/sucursal.
- **Configuración** alimenta POS, apariencia, grupos rápidos y reglas de sucursal; no puede depender sólo de localStorage.

## Riesgos de migración y despliegue

- La migración `20260904170000_pos_terminal_and_line_notes` es aditiva y no destructiva, pero debe aplicarse antes de
  ejecutar código que escriba `SaleItem.note` o `Terminal.printerName/posConfig`.
- No editar migraciones desplegadas. Toda corrección posterior debe ser una migración nueva.
- El autoinicializado de medios ocurre al primer GET y escribe en producción; es idempotente por índice único, pero debe
  probarse con solicitudes concurrentes.
- El build y `prisma:generate` del workspace API requieren `.env`; una instalación limpia falla antes de compilar si no
  existe. El deploy productivo conserva `.env` y aplica `prisma migrate deploy`.
- No se verificaron datos reales, volumen, locks serializables ni compatibilidad con migraciones ya aplicadas.

## Verificaciones de esta auditoría

- Se revisaron App/rutas, páginas principales, servicios frontend, todos los módulos Nest, permisos, schema y 18 SQL.
- Se ejecutan como controles locales: lint, typecheck, 22 tests frontend, 52 tests backend, build y `check:release`.
- PostgreSQL/Redis HTTP/e2e quedan **no ejecutados** por falta de servicios/credenciales en el entorno de auditoría.

## Estabilización de arquitectura — 2026-09-05

- La navegación interna usa History API y un único listener `popstate`; enlaces bajo `/pos/` se interceptan sin recarga
  completa y los enlaces externos/modificados conservan el comportamiento normal del navegador.
- Los redirects legados ya no escriben historial durante render. La ruta protegida de detalle de sucursal exige ahora
  `branches.view`, igual que el listado.
- `/auth/me` puede renovar un access token vencido. Un logout propagado por `BroadcastChannel` limpia también el usuario
  React de las demás pestañas, sin borrar carrito u otros datos mediante `sessionStorage.clear()`.
- La sucursal conserva una preferencia persistente, pero cada pestaña fija su propia selección en `sessionStorage`; al
  cambiarla se remonta el contenido del módulo para impedir que quede visible estado perteneciente a la sucursal anterior.
- El cliente reintenta una sola vez únicamente requests GET fallidos por red; nunca reintenta escrituras. Los errores
  exponen mensaje, estado HTTP y código sin transformar una caída de red en cierre de sesión.
- El filtro global backend registra método, ruta, usuario, estado y código; sólo incluye stack en errores 5xx y nunca
  registra headers, tokens, body ni credenciales.
- No hubo cambios Prisma, migraciones, permisos ni reglas comerciales. Sigue pendiente cancelar búsquedas particulares,
  desacoplar el bootstrap POS y validar múltiples pestañas mediante una prueba e2e en navegador real.

## Orden de trabajo recomendado (sin implementarlo ahora)

1. Levantar PostgreSQL efímero, aplicar las 18 migraciones y crear smoke tests HTTP multi-tenant.
2. Probar en orden: login → sucursal → terminal → caja → catálogo → pago mixto → venta → stock → ticket → anulación.
3. Corregir permisos/errores de Configuración POS y la generación robusta de códigos de terminal.
4. Cancelar búsquedas anteriores y desacoplar las cargas del bootstrap POS para tolerar fallos parciales.
5. Consolidar settings POS en servidor y retirar sólo la ruta/helper local cuando ya no tenga consumidores.
6. Corregir zona horaria de reportes y búsqueda paginada de compras.
7. Completar luego las superficies ya existentes (familias, vencimientos, stock desktop), sin abrir módulos duplicados.

## Decisiones vigentes

- La estabilización modificó infraestructura transversal del frontend y logging backend, sin cambiar reglas comerciales,
  esquema, migraciones ni permisos.
- PostgreSQL/API central siguen siendo la autoridad comercial y el navegador no será fuente de verdad.
- Conservar transacciones, snapshots, soft delete, idempotencia, tenant/sucursal, redirects compatibles y bypass de
  `SUPER_ADMIN`.
