# Changelog de recodificación

Este archivo registra decisiones de la reconstrucción. No reemplaza `PROJECT_STATUS.md` ni pretende convertir cada commit
en una entrada extensa.

## 2026-09-08 — Fase 0: auditoría y puertas de calidad

### Conservado

- Stack React/Vite/TypeScript, NestJS, Prisma, PostgreSQL, Socket.IO y RBAC.
- Servicios centrales existentes de pricing, stock, venta, compra, caja y auditoría.
- Modelo multiempresa/multisucursal y migraciones inmutables.

### Refactor planificado

- Productos y Compras como superficies compactas sobre APIs server-side.
- Caja/terminales como flujo operativo, no como configuraciones dispersas.
- Contratos frontend/backend, carga diferida y remoción gradual de componentes legados.

### Reconstrucción planificada

- Clientes y mayor de cuenta corriente.
- Reportes avanzados, alertas programadas, mensajería a cajas e interfaz de impresión.

### Eliminación planificada

- UIs duplicadas de precios/costos, roles, órdenes y operaciones de stock sólo después de confirmar paridad funcional,
  redirects y ausencia de imports.

### Migraciones

- No se agregaron ni modificaron migraciones en Fase 0.
- El repositorio contiene 24 migraciones; deben aplicarse y validarse en staging antes de avanzar.

### Validación

- Se preparó `E2E_VALIDATION.md` con comandos, recorridos, evidencia esperada y estado.
- Staging permanece BLOCKED en este contenedor por ausencia de Docker/PostgreSQL/Redis accesibles.

### Riesgos conocidos

- El flujo completo aún no está certificado contra PostgreSQL real.
- `ACCOUNT` no tiene un mayor de clientes.
- La migración de suspendidos requiere validación de recuperación concurrente en PostgreSQL.
- Reportes, alertas y hardware de impresión no constituyen dominios completos.


## 2026-09-08 — Fase 1: ventas suspendidas compartidas

- Se reemplazó `localStorage` por `SuspendedSale` persistido, vinculado a empresa, sucursal, terminal, sesión y usuario.
- Suspender, listar, recuperar y cancelar se autorizan en backend; el snapshot se sanea, el total se recalcula con Decimal y cada transición queda auditada.
- La recuperación usa una transacción serializable y cambio condicional para que dos cajas no consuman el mismo carrito.
- El POS lista los pendientes de la sucursal y permite recuperar desde otra terminal autorizada.
- Se agregó la migración aditiva `20260908120000_persist_suspended_sales`; su aplicación real continúa BLOCKED sin staging.

## 2026-09-08 — Documentación en formato textual

- Se reemplazó el informe PDF binario por `docs/ESTADO_ACTUAL_SISTEMA.svg`, un resumen visual editable y revisable en Git.
- El informe completo continúa disponible en Markdown; no hubo cambios de código, esquema, migraciones ni permisos.
