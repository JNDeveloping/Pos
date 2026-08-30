# Estado general

Aplicación existente y compilable, en piloto online y con arquitectura multiempresa/multisucursal conservada. Hay
flujos importantes implementados (catálogo, compras, stock agregado, POS y ventas), pero **ningún módulo se declara
completamente terminado** en esta auditoría porque no se volvió a validar de punta a punta contra PostgreSQL real. La
documentación anterior registra smoke tests manuales; la cobertura automatizada actual es principalmente unitaria.

# Arquitectura actual

- Monorepo npm: SPA/PWA React 19 + Vite 7 en `apps/admin`, API NestJS 11 + Prisma 6 en `apps/api`.
- PostgreSQL 16 central como fuente de verdad; Redis 7 auxiliar. PWA online sin caché de API/IndexedDB.
- Producción prevista en `/pos/`, proxy `/pos/api` a Nest `/api`, puerto interno 3002; Apache, Nginx, Docker y systemd
  versionados.
- Tenant por `companyId`, operación por `branchId`, guard JWT/RBAC global y `SUPER_ADMIN` con bypass explícito.
- 13 migraciones versionadas (incluidas la creación y posterior eliminación del offline legado).

# Módulos terminados

- Ninguno certificado de punta a punta durante esta auditoría documental.
- A nivel transversal sí están implementados el limpiador que impide reintroducir offline legado, el catálogo central de
  permisos con sync no destructivo y el bypass de `SUPER_ADMIN`, todos con tests unitarios.

# Módulos parcialmente implementados

- **Autenticación/RBAC:** login, refresh/logout, sesión, roles, permisos, alcance de sucursal y protecciones del último
  superadministrador. Roles está integrado por tab/redirección en Usuarios, aunque conserva pantallas/rutas legadas.
- **Inicio:** ventas hoy/ayer/mes, tickets, promedio, ganancia y margen estimados, unidades vendidas, stock,
  vencimientos, bajo margen, top productos, ventas recientes, medios de pago y gráficos de 7/30 días y por hora. Faltan
  compras recomendadas y productos de baja rotación.
- **Productos:** pantalla y alta simplificadas en General, Venta, Stock, Proveedores y Opcional; catálogo paginado,
  edición rápida por ficha, barcode, categorías, familia, import/export, acciones masivas e inicialización transaccional
  de stock Local/Depósito. `SUPER_ADMIN` puede aplicar soft delete eficiente a todo el catálogo con confirmación fuerte.
- **Proveedores/compras:** ficha de proveedor, relación multi-proveedor y aliases, órdenes, compras, confirmación,
  actualización opt-in de costo, ingreso idempotente de stock y revisión de factura. La recomendación de compras no está.
- **Facturas:** carga, almacenamiento validado, matching y corrección humana; sólo existe adaptador manual, sin OCR/IA
  productivo.
- **Stock:** cantidad agregada por producto/sucursal, reservas/tránsito, movimientos, ajustes, inventarios, mermas,
  transferencias entre sucursales, lotes/vencimientos y recepción de compras. Las pantallas operativas secundarias son
  básicas y ahora se acceden principalmente desde Stock.
- **POS/ventas:** inicio rápido sin salir del POS para sucursal/cajero/terminal/fondo y apertura persistida de caja;
  scanner, teclado, grupos táctiles configurables, teclado numérico para pesables, pagos, venta idempotente, ticket,
  anulación, devolución y acceso Admin. Suspendidos continúan locales y aún no existe cierre/arqueo.
- **Configuración:** seis secciones simples persistidas en `CompanySetting`/`BranchSetting`; subida real de fondo POS,
  apariencia compartida y editor por sucursal de grupos, iconos, orden, productos y tamaños táctiles.
- **Sucursales/usuarios/auditoría/etiquetas:** CRUD y vistas funcionales iniciales; ficha de sucursal usa tabs, auditoría
  traduce códigos conocidos y etiquetas imprimen presets básicos, todavía sin editor profesional en mm.

# Módulos rotos

- No se encontró un módulo completamente inutilizable mediante revisión estática/build/tests.
- La UI de reposición depósito → local todavía no está expuesta, aunque los saldos `SALE_FLOOR`/`WAREHOUSE` ya se
  persisten y las altas/ventas/compras asignan ubicación.

# Pendientes

- Completar la UI de reposición interna depósito → local y sus movimientos específicos.
- Completar producto único por tabs: comercial, stock por ubicación, proveedores, lotes/vencimientos, POS e historial.
- Acciones masivas faltantes: categoría, familia, proveedor, mínimo, etiquetas/exportación integradas y desactivación
  robusta con preview/auditoría.
- Compras recomendadas explicables por cobertura, venta histórica, bultos y proveedor preferido.
- Promociones/liquidaciones temporales (porcentaje, fijo, 2x1, 3x2, segunda unidad) sin alterar precio base.
- Presets profesionales de etiquetas en mm y flujo selección → cantidad → preview → impresión.
- Persistir shortcuts configurables y carritos suspendidos según sucursal/terminal en servidor.
- Pruebas HTTP/e2e automatizadas con PostgreSQL aislado para los recorridos críticos.

# Últimos cambios

- 2026-08-30: migración de operación táctil incorpora aperturas de caja, grupos rápidos configurables y saldos de stock
  Local/Depósito; se simplifican Productos y Configuración, el fondo POS se sirve desde backend y la venta exige caja
  abierta cuando la sucursal así lo configura.
- 2026-08-30: el POS incorpora selector rápido de categorías y productos (incluidos Panadería, Frutas o Carbón cuando
  esas categorías existen), y un botón ADMIN responsivo con bypass de `SUPER_ADMIN`; el panel adopta un centro de
  operaciones oscuro/verde con navegación y retorno al modo venta más directos.
- 2026-08-30: se establece como regla permanente que cada entrega incluya pasos completos de actualización productiva
  y recarga de la PWA, señalando migraciones o sincronización de permisos cuando corresponda.
- 2026-08-30: identidad visual verde/negra; Dashboard ampliado con métricas, filtros y gráficos automáticos; acceso
  directo autorizado del POS al panel; `SUPER_ADMIN` recupera acceso a Configuración y la API valida el tenant/sucursal.
- 2026-08-17: auditoría integral del repositorio; se crean esta guía permanente y el estado vivo, sin iniciar módulos.
- Commits previos consolidaron navegación/dashboard/productos, reconstruyeron el POS y centralizaron configuración,
  redirects y etiquetas de auditoría.

# Migraciones importantes

- `20260807170000_initial`: núcleo de empresa, sucursales, identidad/RBAC y catálogo.
- `20260811130000_remove_temporary_offline_sync`: elimina el intento de sincronización offline del navegador.
- `20260812120000_message3_commercial_catalog`: catálogo comercial, listas, históricos y auditoría.
- `20260813120000_message4_purchases`: proveedores, relaciones, órdenes, compras y documentos analizados.
- `20260816120000_message5_stock`: stock agregado, movimientos, lotes, inventarios, mermas y transferencias.
- `20260817120000_message6_sales`: terminales, medios de pago, ventas, pagos y devoluciones.
- `20260818120000_unified_product_core`: familias y atributos adicionales de proveedor-producto.
- `20260819120000_server_settings`: configuración JSON por empresa y sucursal.
- `20260830170000_pos_touch_operation`: sesiones de caja, grupos rápidos configurables y saldos por ubicación; migra el
  stock histórico existente a `SALE_FLOOR` sin borrar movimientos ni existencias.

# Decisiones técnicas

- Operación 100% online; PostgreSQL/API central son autoridad y el Service Worker sólo conserva el shell.
- UUID, UTC, Decimal, soft delete, índices por tenant y transacciones para operaciones críticas.
- `Product` es catálogo de empresa; `BranchProduct` define surtido y comercialización por sucursal.
- Menos navegación principal: precios/costos/roles/inventario/movimientos/transferencias/órdenes se integran o redirigen.
- Facturas siempre requieren revisión humana; el adaptador manual es el comportamiento seguro por defecto.

# Problemas conocidos

- README y documentos de etapas conservan afirmaciones históricas ya superadas (por ejemplo “sin ventas/stock” o
  “no crea stock”); usar schema/código y este archivo como estado actual.
- Fechas del Dashboard se cortan con zona horaria del proceso/UTC y no aplican explícitamente
  `America/Argentina/Buenos_Aires`; los límites diarios pueden ser incorrectos en producción.
- La búsqueda global del layout es sólo visual. Algunas rutas/componentes legados siguen presentes aunque haya redirects.
- No existe `UserPreference`; carrito y ventas suspendidas no críticas permanecen en almacenamiento del navegador.
- No hay OCR/LLM real, cuenta corriente de proveedor, FEFO, promoción temporal, cierre/arqueo o hardware fiscal.

# Próximos pasos

1. Continuar paso a paso según el próximo pedido, sin reestructuración automática.
2. Corregir primero cualquier riesgo de tenant/sucursal en el flujo que se toque y agregar su prueba.
3. Priorizar el diseño de stock por `SALE_FLOOR`/`WAREHOUSE` y la consolidación del producto cuando sean solicitados.
4. Mantener este archivo actualizado después de cada entrega importante.
