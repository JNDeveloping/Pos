# Validación E2E de la recodificación

**Estado general:** BLOCKED  
**Motivo:** el entorno actual no dispone de Docker, `psql` ni una URL de PostgreSQL de staging.

## 1. Preparación reproducible

```bash
cd /workspace/Pos
cp .env.example .env
docker compose up -d postgres redis
npm ci
npm run prisma:generate
npm run db:deploy
npm run db:seed
npm run permissions:sync
npm run dev:api
```

En otra terminal:

```bash
curl -fsS http://127.0.0.1:3002/api/health
```

La evidencia debe incluir versiones de PostgreSQL/Redis, lista de migraciones aplicadas, usuario de prueba, empresa y
sucursales utilizadas. No incluir contraseñas ni tokens.

## 2. Recorrido comercial principal

| Paso                     | Resultado esperado                                         | Estado  |
| ------------------------ | ---------------------------------------------------------- | ------- |
| Crear producto           | Maestro de empresa y configuración de sucursal persistidos | BLOCKED |
| Asignar proveedor        | `SupplierProduct` pertenece a la misma empresa             | BLOCKED |
| Configurar costo         | `CostHistory` registra usuario y origen                    | BLOCKED |
| Calcular precio          | Pricing aplica margen/herencia/redondeo con Decimal        | BLOCKED |
| Cargar stock             | `Stock` y ubicación coinciden; existe movimiento           | BLOCKED |
| Crear/confirmar compra   | Compra, costo, proveedor, stock y auditoría son atómicos   | BLOCKED |
| Abrir caja               | Sólo una sesión OPEN por terminal                          | BLOCKED |
| Escanear                 | POS resuelve barcode y precio final vigente                | BLOCKED |
| Cobrar efectivo          | Venta/pago/stock se confirman juntos y calcula vuelto      | BLOCKED |
| Reintentar `operationId` | Devuelve la misma venta sin duplicar                       | BLOCKED |
| Suspender en Caja 1      | Persiste snapshot y auditoría en PostgreSQL              | BLOCKED |
| Recuperar en Caja 2      | Entrega el carrito una vez y bloquea una segunda lectura   | BLOCKED |
| Reimprimir               | Registra auditoría y conserva la venta                     | BLOCKED |
| Cerrar caja              | Esperado, contado y diferencia son correctos               | BLOCKED |
| Consultar administración | Venta, stock y cierre quedan visibles                      | BLOCKED |

## 3. Cliente y cuenta corriente

| Paso             | Resultado esperado                              | Estado      |
| ---------------- | ----------------------------------------------- | ----------- |
| Crear cliente    | Cliente por empresa con código/documento válido | NOT_STARTED |
| Venta a cuenta   | Movimiento SALE aumenta saldo y valida límite   | NOT_STARTED |
| Pago parcial     | Movimiento PAYMENT reduce saldo e impacta caja  | NOT_STARTED |
| Estado de cuenta | Saldo derivado del mayor, imprimible/exportable | NOT_STARTED |

No ejecutar este recorrido usando solamente `PaymentMethod.kind = ACCOUNT`: ese dato no reemplaza el dominio cliente.

## 4. Cambio de costo y etiqueta

| Paso                             | Resultado esperado                             | Estado  |
| -------------------------------- | ---------------------------------------------- | ------- |
| Confirmar compra con costo nuevo | Crea `CostHistory`                             | BLOCKED |
| Obtener sugerencia               | Usa el mismo `PriceCalculationService`         | BLOCKED |
| Aceptar precio                   | Actualiza `BranchProduct.salePrice`            | BLOCKED |
| Ver historial                    | Crea `PriceHistory` con regla y márgenes       | BLOCKED |
| Ver pendiente                    | Crea `LabelPrintQueue`                         | BLOCKED |
| Consultar POS                    | Devuelve inmediatamente el precio persistido   | BLOCKED |
| Imprimir/marcar                  | La cola pasa a impresa sin perder trazabilidad | BLOCKED |

## 5. Transferencia entre sucursales

| Paso      | Resultado esperado                               | Estado  |
| --------- | ------------------------------------------------ | ------- |
| Solicitar | No modifica stock físico                         | BLOCKED |
| Despachar | Reduce origen y aumenta en tránsito una sola vez | BLOCKED |
| Recibir   | Reduce tránsito y aumenta destino una sola vez   | BLOCKED |
| Auditar   | Movimientos enlazados a transferencia y usuarios | BLOCKED |

## 6. Pruebas no funcionales

- 50.000 productos: medir p50/p95 de barcode, búsqueda, Productos, Compras y Stock.
- Concurrencia: doble apertura, doble venta, recepción repetida y dos ajustes simultáneos.
- Multiempresa: IDs de otra empresa deben producir 404/403 sin filtrar datos.
- Multisucursal: usuario restringido no puede operar terminal, caja, compra ni stock ajenos.
- Proxy: validar polling y upgrade WebSocket de `/pos/api/socket.io`.
- Navegador: 20 escaneos consecutivos, foco, PWA actualizada, 1366x768 y 1920x1080.

## 7. Criterio de aprobación

Un estado cambia de BLOCKED/PARTIAL a DONE sólo cuando se registra:

1. comando o caso automatizado;
2. fecha y entorno;
3. resultado verificable;
4. evidencia de base/API/UI cuando corresponda;
5. ausencia de datos sensibles en logs o adjuntos.
