export function nextStock(current: number, delta: number, allowNegative = false) {
  const next = current + delta;
  if (!Number.isFinite(next)) throw new Error('Cantidad inválida');
  if (!allowNegative && next < 0) throw new Error('Stock insuficiente');
  return next;
}

export const availableStock = (quantity: number, reserved: number) => quantity - reserved;

export const stockStatus = (available: number, minimum: number) =>
  available <= 0 ? 'OUT_OF_STOCK' : available <= minimum ? 'LOW' : 'NORMAL';

export function aggregatePurchaseUnits(items: Array<{ productId: string; totalUnits: number }>) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.totalUnits);
  return totals;
}
