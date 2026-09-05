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
- Existen 22 migraciones inmutables. La última, `20260905230000_pos_live_events`, conserva una cronología operativa mínima
  del POS para el monitor de cajas en vivo.
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
- **Categorías/familias:** categorías tienen CRUD jerárquico y el editor limita subcategorías a la categoría elegida.
  `ProductFamily` tiene modelo/API y puede asignarse o quitarse al crear/editar; la gestión masiva de familias sigue pendiente.
- **Stock escritorio:** no expone reposición local aunque API y móvil sí; operaciones secundarias muestran JSON técnico.
- **Vencimientos:** consulta y lotes existen, pero falta una UX comercial con riesgo, valor, filtros y edición desde ficha.
- **Compras frontend:** las altas cargan sólo los primeros 100 productos; sin búsqueda remota no escalan al catálogo real.
- **Proveedores:** ficha y relaciones funcionan; cuenta corriente no existe y permanece fuera del alcance aprobado.
- **Etiquetas:** Fleje, Cartel FyV y A5 Liqui imprimen con composición física; falta calibración por impresora y marcar como
  impresa sigue siendo una acción separada del diálogo del navegador.
- **Terminales:** esquema, alta, edición, activación/desactivación y apertura rápida existen. `posConfig` se persiste pero
  todavía no tiene editor específico; el código rápido aún puede chocar si existe una terminal inactiva con ese código.
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
- Impresión nativa directa y mayor contable general; el arqueo operativo y los movimientos manuales de caja ya existen.

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
- El autoinicializado de medios completa faltantes en cada GET y es idempotente por índice único; debe probarse con
  solicitudes concurrentes sobre PostgreSQL.
- El build y `prisma:generate` del workspace API requieren `.env`; una instalación limpia falla antes de compilar si no
  existe. El deploy productivo conserva `.env` y aplica `prisma migrate deploy`.
- No se verificaron datos reales, volumen, locks serializables ni compatibilidad con migraciones ya aplicadas.

## Verificaciones de esta auditoría

- Se revisaron App/rutas, páginas principales, servicios frontend, todos los módulos Nest, permisos, schema y 22 SQL.
- Se ejecutan como controles locales: lint, typecheck, 24 tests frontend, 60 tests backend, build y `check:release`.
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
- No hubo cambios de permisos. Sigue pendiente desacoplar el bootstrap POS y validar múltiples pestañas mediante una prueba
  e2e en navegador real.

## Reestructuración operativa del POS — 2026-09-05

- El scanner vacía el campo al presionar Enter antes de consultar y agrega mediante actualización funcional del carrito;
  esto evita concatenar códigos o perder incrementos cuando llegan lecturas consecutivas.
- La búsqueda textual espera 220 ms, cancela la consulta anterior y mantiene el límite backend de 30 resultados. Busca
  nombre, nombre corto, código interno, SKU, marca, barcode y códigos/descripciones/aliases de proveedor. Un número no
  encontrado como barcode vuelve a buscarse como código interno o alternativo.
- Unidad suma enteros; KG, gramos, litros y metros admiten hasta tres decimales. Pesables siguen solicitando peso y los
  productos con precio abierto sólo permiten edición si producto, sucursal y permiso lo autorizan.
- Cantidad, precio autorizado, descuento autorizado, nota y eliminación permanecen en la línea y el total se deriva
  inmediatamente del carrito. Las suspendidas guardan el snapshot completo y ahora quedan filtradas por sucursal.
- Los accesos configurados siguen siendo la autoridad. Sin configuración, las categorías Frutas/Verduras, Panadería,
  Fiambres y Leña/Carbón se priorizan cuando existen y el resto continúa disponible hasta el límite táctil.
- Venta rápida requiere `sales.manualPrice`, descripción, precio y cantidad. Se persiste transaccionalmente como
  `SaleItem` sin producto/BranchProduct, costo e impuesto cero, se audita y no modifica stock. Anulación/devolución tampoco
  inventan movimientos físicos para esas líneas.
- La migración nueva sólo vuelve opcionales tres referencias escalares históricas; no elimina tablas ni datos. Antes de
  producción debe aplicarse y probarse sobre PostgreSQL con venta, anulación y devolución rápida.

## Medios de pago y cierre de venta — 2026-09-05

- Cada medio tiene naturaleza persistida: efectivo, débito, crédito, transferencia, QR/billetera, cuenta corriente u otro.
  Los valores iniciales completan Efectivo, Débito, Crédito, Transferencia, QR/Mercado Pago, Cuenta corriente y Otro sin
  borrar ni duplicar configuraciones existentes.
- El cobro combinado exige que la suma redondeada de todos los medios coincida exactamente con el total. Efectivo separa
  importe aplicado, importe recibido y vuelto; los otros medios no generan efectivo en caja.
- Cuenta corriente exige referencia de cliente/cuenta y el permiso nuevo `sales.accountCredit`; sin autorización no se
  muestra en el POS y el backend también rechaza el cobro. No se implementó todavía un mayor de clientes o límite crediticio.
- `Payment.cashImpact` conserva el importe que físicamente ingresó en efectivo. Al cerrar caja se calcula apertura más
  efectivo de ventas completadas, se devuelve diferencia contra lo contado y se guarda el desglose en auditoría.
- El frontend conserva un `operationId` durante todo el intento y bloquea confirmaciones concurrentes. Si dos requests con
  el mismo identificador compiten, el backend recupera y devuelve la venta confirmada en lugar de duplicarla.
- Venta, items, pagos, impacto efectivo, stock y auditoría permanecen en una única transacción serializable. La migración
  `20260905170000_payment_method_nature` es aditiva, pero requiere deploy y `permissions:sync` antes de habilitar cuenta
  corriente a roles autorizados.

## Cajas y terminales — 2026-09-05

- Terminal física pertenece a empresa/sucursal y admite nombre, código único, estado, impresora y configuración POS. La
  pantalla de Configuración permite crear, editar y activar/desactivar; una terminal con sesión abierta no se desactiva.
- Sin caja abierta, el POS ofrece sucursal autorizada, cajero, terminal y fondo inicial. Si no hay terminal, un usuario con
  `terminals.manage` puede crearla desde la misma apertura sin abandonar el flujo.
- La migración `20260905200000_cash_movements_and_open_guard` agrega un índice único parcial para que PostgreSQL impida dos
  sesiones `OPEN` de la misma terminal, incluso ante aperturas concurrentes.
- `CashMovement` registra ingreso, gasto o retiro con importe, motivo, usuario, fecha, sucursal, sesión y origen. Crear y
  consultar movimientos requieren `cashSessions.movements.create/view` y cada alta genera auditoría en la transacción.
- El esperado se calcula como fondo inicial + ventas completadas en efectivo + ingresos − gastos − retiros. El cierre
  muestra esperado, contado y diferencia antes de confirmar, y conserva esos valores en Auditoría.
- No se modificó el dominio de pagos ni stock en esta etapa. La migración es aditiva, pero el índice fallará deliberadamente
  si una base ya contiene dos sesiones abiertas para una misma terminal; esos datos deben auditarse antes del deploy.

## Caja en vivo — 2026-09-05

- Socket.IO comparte actividad casi inmediata bajo el path público `/pos/api/socket.io`; el cliente reconecta con backoff
  y vuelve a registrar sucursal, terminal, sesión y snapshot del carrito después de cada reconexión.
- El gateway valida JWT, `tokenVersion`, empresa, sucursal, terminal activa y `sales.access`. Sólo usuarios con
  `sales.liveView` reciben eventos, limitados a su empresa y, cuando corresponde, su sucursal asignada.
- Se transmiten conexión/desconexión, escaneo, carrito sanitizado, eliminación, descuento, inicio/actualización de cobro,
  cancelación del carrito y venta finalizada. Nunca se envían tokens, referencias de pago, tarjeta, costo ni margen.
- `PosLiveEvent` persiste usuario, sucursal, terminal, sesión, tipo, payload mínimo y fecha. El historial HTTP devuelve hasta
  250 eventos recientes y cajas abiertas; no reemplaza `AuditLog` para cambios comerciales definitivos.
- La pantalla `/admin/cash-live` filtra por sucursal y terminal, muestra conexión, cajero, carrito, cantidades, subtotales,
  total y cronología. Requiere `sales.liveView` y aparece en navegación sólo con ese permiso.
- La migración es aditiva y no modifica ventas. Producción debe habilitar WebSocket/Upgrade en el proxy para
  `/pos/api/socket.io`; si el upgrade no está disponible, Socket.IO conserva fallback de long polling.
- La presencia online se mantiene en memoria del proceso API, suficiente para el despliegue actual de una instancia. Antes
  de escalar horizontalmente se necesita un adaptador Socket.IO/Redis para compartir presencia y salas entre instancias.

## Productos para operación diaria — 2026-09-05

- Productos queda como única superficie de catálogo: las rutas históricas Catálogo Maestro y Marcas redirigen a Productos;
  marca permanece como atributo opcional de la ficha, sin sección principal duplicada.
- El listado conserva paginación server-side de 20 filas, agrega búsqueda remota con debounce y protección contra respuestas
  tardías, y filtra por categoría, familia y sucursal sin descargar el catálogo completo.
- Alta y edición separan identidad, venta por sucursal, stock, proveedores e historial. Se incorporaron familia,
  subcategoría dependiente y hasta 20 códigos alternativos por alta; luego pueden administrarse individualmente en la ficha.
- Backend valida pertenencia tenant de categoría, subcategoría, familia y marca, y devuelve errores explícitos antes de
  persistir códigos internos o barcodes duplicados. No hubo cambio de esquema ni migración en esta etapa.
- Stock se presenta por sucursal y separado entre local, depósito, total y disponible. Las modificaciones físicas continúan
  exclusivamente en Stock para conservar movimiento y auditoría.
- Pendiente: prueba de carga HTTP/PostgreSQL con 50.000 productos reales; los índices trigram existentes y la paginación
  evitan carga masiva en navegador, pero la latencia objetivo todavía no está certificada en infraestructura productiva.

## Edición masiva de productos — 2026-09-05

- La selección se conserva al paginar y los filtros de búsqueda, categoría, familia y estado sobreviven durante la pestaña.
  También puede resolver en servidor hasta 5.000 IDs que coincidan con el filtro actual. El editor masivo admite esos lotes
  para categoría/subcategoría, familia, proveedor, stock mínimo, estado, habilitación por sucursal, precio y baja lógica.
- Toda operación exige una vista previa. Los cambios económicos reutilizan el cálculo del backend y muestran precio anterior
  y nuevo antes de aplicar; al confirmar conservan `PriceHistory`/`CostHistory` y una auditoría consolidada del lote.
- Los cambios maestros y operativos se validan por tenant, sucursal y relaciones antes de una única transacción; proveedor
  se agrega sin reemplazar vínculos existentes. La UI queda ocupada con feedback mientras el servidor procesa el lote.
- Vaciar el catálogo permanece como baja lógica administrativa: ahora exige `products.purgeAll` y escribir exactamente
  `VACIAR PRODUCTOS`. `products.bulkUpdate` gobierna el resto de cambios masivos. Ambos permisos requieren sincronización.
- No hubo cambio de schema ni migración. Pendiente: medir un lote de 5.000 productos contra PostgreSQL real y ajustar el
  tiempo máximo si la infraestructura productiva no completa las historias económicas dentro de 120 segundos.

## Orden de trabajo recomendado (sin implementarlo ahora)

1. Levantar PostgreSQL efímero, aplicar las 22 migraciones y crear smoke tests HTTP multi-tenant/WebSocket.
2. Probar en orden: login → sucursal → terminal → caja → catálogo → pago mixto → venta → stock → ticket → anulación.
3. Corregir permisos/errores de Configuración POS y la generación robusta de códigos de terminal.
4. Desacoplar las cargas del bootstrap POS para tolerar fallos parciales.
5. Consolidar settings POS en servidor y retirar sólo la ruta/helper local cuando ya no tenga consumidores.
6. Corregir zona horaria de reportes y búsqueda paginada de compras.
7. Completar luego las superficies ya existentes (familias, vencimientos, stock desktop), sin abrir módulos duplicados.

## Decisiones vigentes

- La estabilización y el POS modificaron frontend, backend y migraciones aditivas; los permisos nuevos
  `sales.accountCredit` y `cashSessions.movements.view/create` deben asignarse sólo a roles expresamente autorizados.
- PostgreSQL/API central siguen siendo la autoridad comercial y el navegador no será fuente de verdad.
- Conservar transacciones, snapshots, soft delete, idempotencia, tenant/sucursal, redirects compatibles y bypass de
  `SUPER_ADMIN`.
