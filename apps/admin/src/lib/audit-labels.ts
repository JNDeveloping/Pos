const ACTIONS: Record<string, string> = {
  PRODUCT_CREATED: 'Producto creado',
  PRODUCT_UPDATED: 'Producto modificado',
  PRODUCT_DISABLED: 'Producto desactivado',
  PRODUCTS_BULK_DISABLED: 'Productos desactivados',
  PRICE_CHANGED: 'Precio modificado',
  COST_CHANGED: 'Costo modificado',
  BULK_PRICE_UPDATE: 'Precios actualizados masivamente',
  BULK_COST_UPDATE: 'Costos actualizados masivamente',
  STOCK_ADJUSTED: 'Stock ajustado',
  INITIAL_STOCK_LOADED: 'Stock inicial cargado',
  PURCHASE_CONFIRMED: 'Compra confirmada',
  SUPPLIER_CREATED: 'Proveedor creado',
  SUPPLIER_UPDATED: 'Proveedor modificado',
  SALE_COMPLETED: 'Venta completada',
  SALE_CANCELLED: 'Venta anulada',
  SALE_RETURN_CREATED: 'Devolución registrada',
  SETTINGS_UPDATED: 'Configuración modificada',
  INVENTORY_CONFIRMED: 'Inventario confirmado',
  WASTE_REGISTERED: 'Merma registrada',
  STOCK_TRANSFER_RECEIVED: 'Transferencia recibida',
};
export const auditActionLabel = (code: string) => ACTIONS[code] ?? 'Acción administrativa';
export function auditNarrative(log: {
  action: string;
  user: { firstName: string; lastName: string };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const who = `${log.user.firstName} ${log.user.lastName}`;
  if (log.action === 'PRICE_CHANGED')
    return `${who} modificó el precio de $${log.before?.salePrice ?? '—'} a $${log.after?.salePrice ?? '—'}.`;
  if (log.action === 'STOCK_ADJUSTED') return `${who} ajustó el stock registrado.`;
  return `${who}: ${auditActionLabel(log.action).toLowerCase()}.`;
}
