# Mensaje 3 — catálogo comercial

## Política de margen y redondeo

La política única de esta etapa es **markup sobre costo**:

```text
precio = costo × (1 + margen / 100)
margen = (precio - costo) / costo × 100
```

El redondeo siempre se realiza hacia arriba y admite `NONE`, `MULTIPLE_10`, `MULTIPLE_50`, `MULTIPLE_100` y `CUSTOM`. Las reglas psicológicas terminadas en 90/99 quedan fuera de esta etapa.

## Catálogo y sucursales

`Product` conserva identidad global, clasificación, presentación, contenido, códigos y atributos logísticos. `BranchProduct` conserva costo, precio minorista efectivo, margen, mínimo, favorito y ubicación. No existe stock actual en esta etapa.

La lista `MINORISTA` se crea para todas las empresas existentes durante la migración y para empresas piloto desde el seed. `BranchProduct.salePrice` continúa siendo el precio efectivo mientras `PriceListItem` permite incorporar listas adicionales sin romper compatibilidad.

## Seguridad y auditoría

Los endpoints filtran siempre por `companyId`; las operaciones por sucursal validan además el alcance del usuario. El costo sólo se entrega con `costs.view`. Los cambios comerciales guardan `PriceHistory`, `CostHistory` y `AuditLog` dentro de la misma transacción.

## Importación y exportación

El importador conserva `Codigo`, `Descripcion` y `Rubro`, y reconoce marca, subcategoría, costo, precio, presentación, contenido, unidad, bulto, IVA, SKU y ubicación. El cliente envía lotes de 500 filas y nunca renderiza las 47.000 filas simultáneamente. La exportación CSV admite hasta 50.000 productos y respeta la visibilidad de costos.

## PWA

La PWA continúa 100% online. El Service Worker limita su scope a `/pos/`, precachea exclusivamente el shell y no cachea API ni datos comerciales. No existen IndexedDB, `SyncQueue` ni `SyncService`.
