# Estado real del proyecto — auditoría 2026-09-04

## Alcance y verificación

Se volvió a contrastar el repositorio completo (SPA, API, Prisma, 17 migraciones, permisos, rutas, scripts y tests),
tomando el código ejecutable como fuente de verdad. El sistema es un piloto funcional y amplio, pero no está terminado
de punta a punta ni fue validado en esta revisión contra PostgreSQL/Redis reales. Después de generar Prisma pasan los 67
tests unitarios actuales (17 frontend y 50 backend), lint, typecheck, build de ambas aplicaciones y el control de
release. Una instalación limpia necesita ejecutar `prisma:generate`: sin cliente generado los tests backend no compilan.
El script normal de build de la API también exige que exista `.env`, incluso cuando sólo se quiere compilar.

## Arquitectura y seguridad comprobadas

- Monorepo npm workspaces: React 19/Vite 7/PWA bajo `/pos/`; NestJS 11/Prisma 6/PostgreSQL con prefijo `/api`; Redis es
  auxiliar y tolerante a fallos. La PWA precachea sólo shell/assets y no hay IndexedDB ni caché comercial offline.
- El esquema conserva UUID, `Decimal`, timestamps, soft delete y separación `companyId`/`branchId`. Hay 17 migraciones
  ordenadas; las últimas agregan ubicaciones de stock, caja, acceso multi-sucursal y cola de etiquetas.
- El guard JWT es global, vuelve a consultar usuario/roles/permisos en cada request, respeta revocación por
  `tokenVersion` y mantiene bypass de `SUPER_ADMIN`. Los controladores sensibles declaran permisos y los servicios
  revisados filtran tenant; los flujos de sucursal críticos validan pertenencia/acceso.
- La cobertura automatizada es mayormente unitaria con dobles de Prisma. No hay suite HTTP/e2e ni prueba automatizada
  de migraciones, concurrencia o transacciones contra PostgreSQL.

## Estado por módulo

### Funcional, pero no certificado de punta a punta

- **Autenticación, usuarios y RBAC:** login/refresh/logout, sesión persistente de dispositivo, roles, permisos,
  sucursales autorizadas, protección del último `SUPER_ADMIN`, alta/edición/baja lógica de usuarios y auditoría.
- **Inicio:** Dashboard consume resumen real (hoy/ayer/mes, margen, stock, vencimientos, medios de pago, series y ventas
  recientes). `/owner` muestra todas las sucursales accesibles, cajas, ventas y alertas con refresco cada 15 segundos.
- **Productos:** listado backend paginado, búsqueda por identidad/barcodes/proveedor, importación/exportación, alta,
  edición, duplicación, baja lógica, cambio de precio, configuración por sucursal, barcodes, proveedor y cronologías.
  La administración móvil usa búsqueda remota, cámara, alta rápida con foto, precio, ajuste y reposición.
- **Proveedores y compras:** ficha y baja lógica de proveedor, relación multi-proveedor/aliases, órdenes, compras,
  confirmación/cancelación, costo opt-in, recepción idempotente y documentos de factura con matching/revisión humana.
- **Stock y ventas:** stock agregado más saldos `SALE_FLOOR`/`WAREHOUSE`, movimientos transaccionales, ajustes,
  reposición móvil, lotes, inventarios, mermas y transferencias. POS resuelve catálogo por sucursal, caja abierta,
  pagos, venta idempotente, ticket, anulación y devolución con snapshots y movimientos.
- **Configuración:** `CompanySetting`/`BranchSetting`, fondo POS como archivo y grupos táctiles por sucursal están
  conectados al backend. Sucursales persiste reglas comerciales, POS y ticket.

### Parcial o superficial

- **Categorías:** CRUD jerárquico básico y asignación desde Producto. **Familias:** modelo y CRUD API existen, y el
  listado muestra la familia, pero el frontend no consume `/product-families` ni permite administrarlas/asignarlas.
- **Vencimientos/lotes:** modelo, consultas y recepción existen; la ruta visible sólo vuelca JSON técnico. No hay editor
  de lotes en Producto, riesgo comercial, valor comprometido ni acciones de liquidación.
- **Stock escritorio:** muestra y ajusta stock, pero no expone reposición depósito→local (sí existe en API y móvil). Las
  vistas de movimientos/inventario/mermas/transferencias son genéricas y muestran JSON; varias quedan sólo como rutas
  legadas. Al cambiar sucursal en el layout, `Stock` no recarga porque su efecto no depende de la sucursal seleccionada.
- **Compras:** no hay recomendaciones explicables. Las altas de compra/orden cargan sólo los primeros 100 productos y
  carecen de búsqueda remota, por lo que no son operables con catálogos grandes.
- **Etiquetas:** se corrigió la hoja en blanco, la cola respeta su cantidad y cada alta con sucursal se agrega como
  pendiente. Hay tres diseños físicos A4: Fleje (14 precios normales), Cartel FyV (9 carteles para frutas/verduras) y
  A5 Liqui (liquidación/oferta). En la cola, imprimir no marca automáticamente; requiere una acción posterior separada.
- **Sucursales:** tres tabs de la ficha (`ETIQUETAS`, `USUARIOS`, `PRODUCTOS`) son textos informativos, no superficies
  funcionales. **Auditoría:** consulta datos reales y traduce acciones conocidas, pero filtra sólo por código y conserva
  detalles JSON técnicos.
- **POS/Caja:** flujo principal amplio, pero shortcuts y suspendidos siguen en almacenamiento del navegador; no hay
  persistencia compartida de suspendidos, arqueo/retiros ni hardware fiscal (estos últimos fuera de alcance actual).
- **Configuración:** seis bloques JSON y grupos POS son funcionales, pero no existe `UserPreference`; todavía queda una
  caché local de ajustes POS y no hay editor central de shortcuts.

### Ausente

- **Promociones/liquidaciones temporales:** no existe modelo Prisma, módulo API, permiso ni pantalla. Los descuentos
  manuales de venta no sustituyen promociones 2x1/3x2/segunda unidad o por vencimiento.
- Compras recomendadas, FEFO, OCR/LLM productivo y cuenta corriente de proveedor no están implementados. OCR automático,
  cuenta corriente y hardware fiscal continúan explícitamente fuera del alcance actual.

## Duplicación, rutas obsoletas y conexiones sin uso

- `App.tsx` todavía importa y registra componentes legados de Precios/Costos, Roles, Órdenes, Inventarios, Movimientos y
  Transferencias, aunque varias rutas `/admin/...` se redirigen a las pantallas consolidadas. Persisten además alias
  duplicados (`/products` y `/admin/products`, `/suppliers` y `/admin/suppliers`, etc.).
- `PriceLists` y sus endpoints CRUD existen pero no están enlazados en la navegación; `PriceListItem` no tiene gestión
  real desde la UI. Los endpoints masivos de costos existen, pero la UI consolidada usa principalmente precios.
- Los componentes dedicados `PurchaseOrders`, `PurchaseOrderNew`, `Commerce` y varias variantes de `StockOperations`
  permanecen compilados aunque sus rutas principales se redirigen o no se ofrecen. No deben evolucionarse como módulos
  paralelos; hay que terminar la integración contextual y luego retirar sólo el código efectivamente inalcanzable.
- La búsqueda global y la campana del layout son decorativas. Una ruta desconocida cae silenciosamente en Dashboard en
  vez de mostrar 404. La autorización frontend de una ficha de sucursal dinámica no asigna un permiso específico, aunque
  el backend sí exige `branches.view`.

## Problemas prioritarios detectados

1. **Validación real pendiente:** montar PostgreSQL de prueba, aplicar las 17 migraciones y ejecutar pruebas HTTP/e2e de
   tenant/sucursal, compra→recepción, stock, caja→venta→anulación/devolución y permisos.
2. **Fechas contables:** Dashboard calcula límites diarios con `Date`/zona del proceso; no fija
   `America/Argentina/Buenos_Aires`, por lo que hoy/ayer y series pueden cortar mal en producción UTC.
3. **Escalabilidad de compras:** reemplazar la carga fija de 100 productos por búsqueda backend paginada.
4. **Contexto de sucursal:** hacer reactiva la pantalla Stock y auditar las demás pantallas que leen `branchContext`
   directamente para evitar datos visualmente obsoletos después de cambiar el selector.
5. **Superficies incompletas:** integrar familias, lotes/vencimientos, reposición desktop, operaciones de stock y
   etiquetas profesionales sin reabrir módulos duplicados.
6. **Higiene de entrega:** automatizar `prisma:generate` en instalación/CI o documentar su precondición; permitir un build
   de compilación sin secretos reales. `npm ci` reporta 8 vulnerabilidades (1 moderada, 7 altas; requieren revisión, no
   `audit fix --force` ciego).

## Decisiones vigentes y siguiente paso

- PostgreSQL/API central siguen siendo la única autoridad comercial; no reintroducir offline comercial.
- Producto/Stock/Compras/Usuarios son las superficies consolidadas; conservar redirects mientras existan enlaces o
  marcadores antiguos y no crear secciones principales duplicadas.
- No se agregó funcionalidad ni migración en esta auditoría. Próximo paso recomendado: preparar una base PostgreSQL
  aislada y una suite smoke HTTP multi-tenant antes de continuar con funcionalidades.

## Cambio posterior — 2026-09-04

- Productos de escritorio incorpora scanner de códigos con cámara en la búsqueda; el valor leído dispara una consulta
  backend paginada sin descargar el catálogo.
- Las etiquetas recuperan visibilidad exclusiva en CSS de impresión y esperan el render antes de abrir el diálogo. Toda
  alta con configuración de sucursal crea, dentro de la misma transacción, una etiqueta pendiente con el precio inicial.
- Se reemplazan las plantillas genéricas por Fleje, Cartel FyV y A5 Liqui, con composición en milímetros, precio sin
  impuestos, precio por unidad de medida y densidades de 14 y 9 carteles por hoja A4 según corresponda.
- Sin migraciones ni cambios de permisos. Queda pendiente calibrar márgenes contra el modelo físico de cada impresora.
