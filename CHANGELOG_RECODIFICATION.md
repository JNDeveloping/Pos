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
- El repositorio contiene 23 migraciones; deben aplicarse y validarse en staging antes de avanzar.

### Validación

- Se preparó `E2E_VALIDATION.md` con comandos, recorridos, evidencia esperada y estado.
- Staging permanece BLOCKED en este contenedor por ausencia de Docker/PostgreSQL/Redis accesibles.

### Riesgos conocidos

- El flujo completo aún no está certificado contra PostgreSQL real.
- `ACCOUNT` no tiene un mayor de clientes.
- Suspendidos continúan en almacenamiento del navegador.
- Reportes, alertas y hardware de impresión no constituyen dominios completos.
