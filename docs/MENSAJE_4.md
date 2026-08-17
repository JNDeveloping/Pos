# Mensaje 4 — compras y proveedores

## Flujo implementado

`Supplier` conserva los datos comerciales; `SupplierProduct` vincula códigos y
descripciones externas al catálogo, y `SupplierProductAlias` aprende las
correcciones humanas normalizadas por proveedor. Una orden puede quedar en
borrador, enviada, recibida parcial, recibida o cancelada. Una compra permanece
editable en `DRAFT/REVIEW` y requiere confirmación explícita.

Los documentos se guardan fuera de PostgreSQL en una ruta configurable,
organizada por empresa/año/mes y con nombre UUID. Se valida tamaño, MIME y firma
binaria. `InvoiceAnalysisService` desacopla el matching del adaptador de IA. El
adaptador `manual` es seguro por defecto: preserva el archivo y lo deja para
revisión sin inventar datos. Un proveedor OCR/IA real queda pendiente de
configurar/implementar mediante esa interfaz.

El matching prioriza código de proveedor, barcode, alias aprendido,
descripción exacta y candidatos textuales. El resultado estructurado se valida,
se señalan diferencias de totales y toda corrección puede aprender un alias.

Al confirmar una compra se pueden aplicar costos explícitamente. Esto genera
`CostHistory` con origen `PURCHASE`, actualiza el último costo del proveedor y
audita la operación. No se crea stock ni movimientos en esta etapa.

## Límites reales

- No hay OCR/LLM productivo incluido: requiere un adaptador y credenciales.
- No se implementan stock, cuenta corriente ni reversión contable.
- Los precios sugeridos siguen disponibles en el módulo comercial; no se
  modifican automáticamente durante la confirmación de compra.
