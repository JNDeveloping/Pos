# Guía permanente de desarrollo — El Rincón de los Nietos POS/ERP

## Proyecto y fuente de verdad

Este repositorio continúa un POS/ERP existente para **El Rincón de los Nietos**. No es un proyecto nuevo y no debe
reestructurarse ni reemplazarse en bloque. Antes de cada tarea, leer este archivo, `PROJECT_STATUS.md`, el código y las
migraciones afectadas. El código ejecutable y el esquema Prisma prevalecen sobre documentación histórica.

Una función sólo está terminada si funciona de punta a punta cuando corresponda: base de datos → backend → permisos →
API → frontend → UX → persistencia → integración → tests. La existencia aislada de un modelo, endpoint, pantalla o
build exitoso no alcanza.

Después de cada tarea importante, actualizar `PROJECT_STATUS.md` de forma breve: estado real, cambio, migración o
decisión, problema conocido y siguiente paso. No copiar conversaciones ni mantener un changelog línea por línea.

## Arquitectura y stack confirmado

- Monorepo npm workspaces, TypeScript 5.9 y Node.js `>=20.19` (producción recomendada: Node 22).
- `apps/admin`: React 19, Vite 7, Tailwind 3, Vitest y PWA con `vite-plugin-pwa`. SPA publicada bajo `/pos/`.
- `apps/api`: NestJS 11, Prisma 6, PostgreSQL 16, JWT, Swagger fuera de producción y Redis tolerante a fallos.
- `packages/shared`: reservado para contratos compartidos; no crear abstracciones prematuras.
- `infra`: Docker Compose, Apache/Nginx, systemd, despliegue y backup/restore.
- Producción: `https://grupolosnietos.com.ar/pos/`; API pública vía `/pos/api`, Nest con prefijo `/api` y puerto interno
  `127.0.0.1:3002`. No cambiar estas rutas ni interferir con el servicio del puerto 3001 sin una razón aprobada.
- PostgreSQL/API central son la única fuente de verdad comercial. La PWA sólo precachea shell/assets versionados y no
  respuestas API.

## Estructura del repositorio

```text
apps/api/src/                 módulos NestJS, guard global, servicios de infraestructura
apps/api/prisma/              schema.prisma, seed, sync de permisos y migraciones ordenadas
apps/admin/src/pages/         pantallas React (router liviano centralizado en App.tsx)
apps/admin/src/components/    layout y componentes transversales
apps/admin/src/lib/           API, sesión, navegación, contexto de sucursal y reglas del POS
apps/admin/src/services/      conectividad online
docs/                         arquitectura, despliegue e historial técnico de etapas
infra/                        configuración y scripts operativos
scripts/                      controles de release y limpieza de offline legado
```

## Reglas generales de desarrollo

- Conservar comportamiento y datos existentes; trabajar incrementalmente y no hacer refactors masivos no solicitados.
- Inspeccionar frontend, backend, Prisma, migraciones, permisos, rutas y tests del flujo antes de editarlo.
- El backend es autoridad: nunca confiar en precio, costo, margen, stock, permisos, tenant, sucursal, descuentos ni
  totales enviados por el navegador. Recalcular y validar en servidor.
- Mantener DTOs validados, respuestas paginadas, consultas eficientes e índices adecuados. El catálogo debe escalar a
  decenas de miles de productos; nunca cargarlo completo en el navegador.
- Evitar duplicar lógica o interfaces. Integrar funciones secundarias mediante tabs, modales y acciones contextuales.
- No envolver imports en `try/catch`. Respetar Prettier/ESLint y los patrones locales antes de introducir librerías.
- Errores de red no deben cerrar sesión, recargar la página, causar requests infinitos ni dejar spinners permanentes.
- No modificar arquitectura, URLs públicas ni infraestructura sin una razón concreta y documentada.

## Base de datos, Prisma y migraciones

- PostgreSQL es la persistencia autoritativa. Usar UUID, timestamps UTC y presentar fechas en
  `America/Argentina/Buenos_Aires`.
- Dinero usa `Decimal(14,2)` (u otra precisión explícita del dominio) y cantidades pesables `Decimal(14,3)`; no usar
  `number` del frontend como autoridad contable.
- Todas las consultas deben respetar `companyId`; los recursos operativos deben respetar también `branchId` y el
  alcance del usuario. Nunca aceptar `companyId` del cliente.
- Mantener integridad referencial, unicidad por tenant, históricos y soft delete de maestros. No borrar datos históricos.
- Usar transacciones para ventas, compras confirmadas, stock, costos/precios, recepción y otras operaciones críticas;
  preservar idempotencia mediante referencias/`operationId` donde ya existe.
- Toda evolución de esquema requiere una migración nueva revisable en `apps/api/prisma/migrations`; no editar una
  migración ya desplegada, no usar `db push` como entrega y no hacer migraciones destructivas sin necesidad y plan de
  preservación.
- Desarrollo: `npm run db:migrate`. Producción: `npm run db:deploy`. Ejecutar `npm run prisma:generate` tras cambiar el
  schema y registrar migraciones relevantes en `PROJECT_STATUS.md`.

## Multiempresa y multisucursal

- Aunque el piloto tenga una sola sucursal, conservar siempre `companyId`, `branchId`, `BranchProduct` y relaciones.
- Una sola sucursal activa se selecciona automáticamente; con varias, se ofrece selector sólo entre los registros
  `UserBranchAccess` del usuario. Una sesión no puede abrir ni operar una caja fuera de esas sucursales.
- `Product` es el catálogo maestro de empresa. `BranchProduct` habilita el surtido y mantiene costo, precio, margen,
  mínimo, favorito y políticas comerciales por sucursal.
- Copiar configuración de sucursal nunca debe copiar existencias físicas. Validar en backend que toda sucursal recibida
  pertenece a la empresa y está permitida para la sesión.

## Permisos y auditoría

- La fuente central es `apps/api/src/permissions/permission-definitions.ts`. Todo endpoint sensible usa
  `@RequirePermissions`; la UI oculta o bloquea acciones, pero no reemplaza la autorización del backend.
- `SUPER_ADMIN` tiene bypass total, incluso para permisos agregados después. Nunca permitir desactivarlo, degradar al
  último superadministrador ni depender de que su tabla de relaciones esté sincronizada para autorizarlo.
- Después de agregar o modificar permisos ejecutar `npm run permissions:sync`. El sync debe ser idempotente: crea
  faltantes, actualiza metadata y nunca borra permisos, roles ni asignaciones.
- Usuarios integra roles/permisos; Roles no debe volver a ser una sección principal independiente.
- Auditar cambios sensibles dentro de la misma transacción. La UI de auditoría debe estar en español y privilegiar
  descripciones humanas (actor, entidad, valor anterior y nuevo), no códigos como `PRODUCT_UPDATED`.

## Productos, categorías y familias

- Productos es el núcleo único para identidad, barcodes, categoría/familia, proveedores, costos/precios/márgenes,
  stock, lotes, vencimientos, presentación, imagen y configuración POS. No recrear secciones principales separadas de
  Precios, Costos, Catálogo Maestro o Marcas.
- El editor debe permanecer organizado aproximadamente en General, Comercial, Stock, Proveedores, Lotes y
  vencimientos, POS e Historial.
- Buscar en backend por nombre, código interno, SKU, barcode y, cuando aplique, códigos/barcodes/descripciones/aliases
  del proveedor. Mantener paginación e índices (incluidos trigramas existentes).
- `ProductFamily` es agrupación comercial para selección y cambios masivos con preview, confirmación, historial y
  auditoría. Categoría puede ser jerárquica y Marca queda sólo como atributo opcional.
- Acciones masivas deben ser eficientes y auditables: activar/desactivar, categoría, familia, proveedor, precio,
  margen, mínimo, etiquetas y exportación. No renderizar decenas de miles de filas.

## Stock, lotes y vencimientos

- El stock usa dos ubicaciones por sucursal, `SALE_FLOOR` (local) y `WAREHOUSE` (depósito); el total agregado debe ser
  siempre la suma de ambas. Reponer depósito → local debe conservar el total y generar trazabilidad; no reutilizar
  transferencias entre sucursales como sustituto.
- Toda variación física pasa por el servicio de stock y crea `StockMovement` atómicamente. No escribir cantidades
  directamente desde controladores/UI.
- La pantalla debe priorizar sin stock, stock bajo y, cuando existan ubicaciones, local vacío con depósito disponible.
- Movimientos, inventarios, mermas y transferencias conservan datos/endpoints pero no deben ser módulos principales;
  integrar sus utilidades dentro de Stock y el historial del producto.
- Los lotes futuros/completados deben contemplar número, cantidad, ubicación, ingreso, vencimiento, costo y notas. La
  vista Vencimientos debe mostrar riesgo comercial y valor comprometido.
- Liquidaciones/promociones por vencimiento son temporales; nunca alterar permanentemente el precio base para
  simularlas.

## Proveedores, compras y facturas

- Un producto admite múltiples proveedores mediante `SupplierProduct`; preservar código, barcode y descripción del
  proveedor, último costo, unidades por bulto, mínimo, preferencia y última compra. Los aliases aprendidos nunca deben
  crear otro producto interno por accidente.
- Proveedor es una ficha comercial completa y usa baja lógica. No eliminar relaciones ni documentos históricos.
- Compras debe responder qué comprar, cuánto, a quién y por qué. Órdenes de compra son una función interna de Compras,
  no una sección principal duplicada.
- Recomendaciones futuras combinan stock, mínimo, venta diaria, cobertura, bultos, proveedor preferido y último costo;
  deben explicar el cálculo y permitir revisión.
- La factura asistida busca por relaciones/aliases y siempre exige revisión humana. Ningún OCR/LLM confirma compras,
  actualiza costos o ingresa stock automáticamente. Los documentos se validan y guardan fuera de PostgreSQL; sus
  metadatos sí se persisten.

## POS y ventas

- POS profesional, online, teclado-first, scanner-first, touch-friendly y rápido. Resolver siempre: producto → sucursal
  → habilitación → lista/precio → stock → carrito; volver a validar todo al cobrar.
- Cantidad admite decimales para pesables. Precio manual y descuentos requieren permisos y límites de sucursal.
- Mantener shortcuts centralizables/configurables. Base esperada: F1 ayuda, F2 búsqueda, F3 cantidad, F4 cobrar, F5
  suspender, F6 recuperar, F7 descuento, F9 precio, F10/DELETE eliminar, F11 últimas ventas, F12 utilidades, ESC cerrar,
  `+` aumentar, `-` disminuir y ENTER confirmar.
- Accesos rápidos y apariencia deben configurarse por sucursal y persistirse en servidor. `localStorage` sólo puede ser
  caché/preferencia no crítica; carrito temporal en `sessionStorage` tampoco sustituye persistencia de ventas.
- Venta, pago, cancelación, devolución y movimientos deben ser transaccionales, idempotentes y mantener snapshots.
- Apertura y cierre básico de caja usan `CashSession` y auditoría. No integrar arqueos, retiros, hardware fiscal o
  persistencia compartida de suspendidos hasta una tarea explícita.

## UI/UX, navegación y configuración

- Filosofía: menos secciones, más utilidades por sección, menos clics, más rapidez y feedback claro.
- Sidebar objetivo: Inicio, Productos, Stock, Vencimientos, Compras, Proveedores, Etiquetas, POS, Sucursales, Usuarios,
  Auditoría y Configuración, filtrado por permisos.
- Mantener redirects de rutas legadas hacia la interfaz consolidada: precios/costos → Productos; roles → Usuarios;
  inventario/movimientos/transferencias → Stock; órdenes → Compras. No mantener dos UIs activas para el mismo flujo.
- Preferir búsqueda backend, selección masiva, tabs, modales contextuales, estados vacíos y mensajes en español.
- Todas las superficies (login, monitor del dueño, administración, panel de caja y POS) deben ofrecer pantalla completa
  mediante la Fullscreen API, con botón visible y salida reversible para equipos all-in-one táctiles.
- Después del login, los usuarios con `panels.admin` ingresan al monitor multi-sucursal `/owner`; los cajeros ingresan
  al POS. Desde el monitor se accede explícitamente al panel administrativo.
- Configuración crítica vive en `CompanySetting`/`BranchSetting` (y `UserPreference` cuando exista), nunca sólo en
  `localStorage`. Fondos subidos deben persistir como archivo en servidor; no almacenar imágenes base64 grandes en JSON.
- Etiquetas usan medidas físicas en mm y presets 65×30, 70×35, 80×40, 100×50, A6, A5, A4 y personalizado, con preview
  antes de imprimir.

## Tests y controles obligatorios

- Para cada cambio relevante agregar/proteger tests de regla y, cuando cruza capas, pruebas de integración/HTTP.
- Prioridad: producto, stock, proveedor, compra/recepción, POS, venta/devolución, promoción, vencimiento, permisos y
  configuración multi-tenant.
- Antes de entregar ejecutar según el alcance: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y
  `npm run check:release`. Cambios Prisma requieren además generar cliente y validar/aplicar migraciones en una base de
  prueba cuando el entorno lo permita.
- Si una prueba depende de PostgreSQL/Redis/credenciales no disponibles, informarlo como limitación; no declarar el
  flujo terminado basándose sólo en mocks.

## Entrega y actualización de la página

- **Toda respuesta final que entregue cambios debe incluir una sección `Pasos para actualizar`**, aunque el cambio sea
  solamente de frontend. No obligar al usuario a buscar instrucciones en mensajes anteriores.
- Indicar comandos completos, en orden y listos para copiar, partiendo de la instalación productiva habitual:
  `cd /var/www/grupolosnietos/pos`, actualizar el código y ejecutar `bash infra/scripts/deploy-production.sh`.
- Después del script, reiniciar y comprobar la API con `sudo systemctl restart rincon-pos-api`,
  `sudo systemctl status rincon-pos-api --no-pager` y `curl -fsS http://127.0.0.1:3002/api/health`.
- Recordar al usuario abrir `https://grupolosnietos.com.ar/pos/`, aceptar el aviso de nueva versión de la PWA si aparece
  y recargar. Si el navegador conserva una versión anterior, indicar recarga forzada (`Ctrl+Shift+R`).
- Si la entrega agrega una migración o cambia permisos, destacarlo expresamente. El script aplica migraciones; ejecutar
  además `npm run permissions:sync` sólo cuando el catálogo de permisos haya cambiado.
- No sugerir copiar sólo `src`, servir fuentes sin compilar, ejecutar `npm run dev` en producción ni borrar `.env`.

## No implementar todavía

- IndexedDB como fuente comercial, colas/sincronización offline del navegador, servidor local por sucursal ni
  PostgreSQL local. La continuidad futura será PWA → API/PostgreSQL local → sincronización → nube, al final del proyecto.
- Confirmación automática de facturas por IA/OCR.
- Hardware fiscal, integración de cajón/impresora nativa, caja, aperturas, cierres o arqueos sin pedido explícito.
- Cuenta corriente de proveedores, fidelización/crédito u otros dominios no solicitados.
- Secciones principales nuevas para marcas, precios, costos, movimientos, inventarios, mermas, transferencias, órdenes
  o roles.
