# Arquitectura objetivo

## Enfoque
Monorepo TypeScript con API NestJS modular, PostgreSQL como fuente central, Redis para caché/colas y una SPA React. El límite de tenant es `companyId`; los recursos operativos agregan `branchId`. Los permisos se evalúan en backend y la asignación opcional de sucursal limita al encargado/cajero.

La fase 3 incorporará un POS Electron con SQLite y patrón **outbox**: cada comando se crea con UUID en una transacción local, se reintenta de forma idempotente y el servidor conserva la clave del evento. PostgreSQL permanece como autoridad central; los conflictos de catálogos usan versión y los eventos de venta son inmutables.

## Estructura
```text
apps/
  api/       NestJS + Prisma (auth, usuarios, empresa, sucursales, catálogo)
  admin/     React + Vite (login y administración inicial)
docs/        decisiones y plan
```

## Decisiones
- UUID desde la aplicación para soportar creación offline futura.
- Dinero con `Decimal(14,2)`, nunca `number` como autoridad de cálculo.
- UTC en persistencia y `America/Argentina/Buenos_Aires` en presentación.
- Soft delete y filtros explícitos en entidades maestras.
- Tokens de renovación rotados; sólo se conserva su hash.
- `BranchProduct` concentra política/precio/stock mínimo por sucursal; el stock contable se separará en fase 2.
- Índices y unicidad siempre incluyen el tenant para evitar cruces entre empresas.

## Entrega incremental
1. **Núcleo:** identidad/RBAC, empresa, sucursales, categorías, marcas, productos y configuración por sucursal.
2. **Operación:** terminal, caja, venta/pagos, stock y movimientos transaccionales.
3. **Continuidad:** Electron, SQLite/outbox, idempotencia, WebSocket y conflictos.
4. **Abastecimiento:** proveedores, compras, transferencias, inventario, lotes y mermas.
5. **Comercial:** promociones, clientes, crédito, fidelización y devoluciones.
6. **Control:** reportes, alertas, auditoría y cartelería.
7. **Inteligencia:** pronóstico estadístico, compra/reposición, rebalanceo y simulación.

Cada incremento exige migración revisada, seed repetible, tests de reglas, typecheck y build antes de avanzar.

## Límites implementados en etapa 1
Los controladores están separados por dominio y comparten un guard global. El JWT determina `companyId`, sucursal, roles y permisos; ningún endpoint acepta el tenant desde el cliente. `UserRole` permite múltiples roles, mientras `RolePermission` mantiene permisos configurables. Las actualizaciones de costo/precio viven en una transacción que también escribe sus historiales.
