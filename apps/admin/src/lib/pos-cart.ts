export type PosProduct = {
  id: string;
  branchProductId: string;
  name: string;
  shortName?: string;
  internalCode: string;
  barcode?: string;
  brand?: string;
  categoryId?: string;
  category?: string;
  presentation?: string;
  unitType: string;
  price: string;
  available: number;
  stockMinimum: number;
  location?: string;
  isWeighted: boolean;
  posFavorite: boolean;
  allowManualPrice: boolean;
  allowNegativeStock?: boolean;
};
export type CartLine = PosProduct & {
  productId?: string;
  quickSale?: boolean;
  quantity: number;
  originalPrice: number;
  manualPrice?: number;
  discountPercent: number;
  discountAmount: number;
  note?: string;
};
export const linePrice = (line: CartLine) => line.manualPrice ?? Number(line.price);
export const lineSubtotal = (line: CartLine) =>
  Math.max(0, linePrice(line) * line.quantity * (1 - line.discountPercent / 100) - line.discountAmount);
export function paymentSummary(total: number, rows: { amount: number; receivedAmount?: number; isCash: boolean }[]) {
  const paid = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return {
    remaining: Math.round((total - paid) * 100) / 100,
    change: rows.reduce((sum, row) => sum + (row.isCash ? Math.max(0, Number(row.receivedAmount ?? row.amount) - row.amount) : 0), 0),
  };
}
export function addProductToCart(lines: CartLine[], product: PosProduct, quantity = 1) {
  if (!(quantity > 0)) throw new Error('La cantidad debe ser mayor que cero');
  const current = lines.find((line) => line.id === product.id);
  const nextQuantity = (current?.quantity ?? 0) + quantity;
  if (nextQuantity > product.available && !product.allowNegativeStock)
    throw new Error(`Stock insuficiente de ${product.name}`);
  if (current) return lines.map((line) => (line.id === product.id ? { ...line, quantity: nextQuantity } : line));
  return [
    ...lines,
    { ...product, quantity, originalPrice: Number(product.price), discountPercent: 0, discountAmount: 0 },
  ];
}

export function createQuickSaleLine(name: string, price: number, quantity = 1): CartLine {
  if (!name.trim()) throw new Error('Ingresá una descripción para la venta rápida');
  if (!(price > 0)) throw new Error('El precio debe ser mayor que cero');
  if (!(quantity > 0)) throw new Error('La cantidad debe ser mayor que cero');
  const id = `quick-${crypto.randomUUID()}`;
  return {
    id,
    branchProductId: '',
    name: name.trim(),
    internalCode: 'VENTA-RÁPIDA',
    unitType: 'UNIT',
    price: String(price),
    available: Number.MAX_SAFE_INTEGER,
    stockMinimum: 0,
    isWeighted: false,
    posFavorite: false,
    allowManualPrice: true,
    allowNegativeStock: true,
    quickSale: true,
    quantity,
    originalPrice: price,
    manualPrice: price,
    discountPercent: 0,
    discountAmount: 0,
  };
}
export const POS_SHORTCUTS = {
  F1: 'HELP',
  F2: 'SEARCH',
  F3: 'QUANTITY',
  F4: 'PAY',
  F5: 'SUSPEND',
  F6: 'RESUME',
  F7: 'DISCOUNT',
  F9: 'PRICE',
  F10: 'REMOVE',
  F11: 'RECENT',
  F12: 'UTILITIES',
  Delete: 'REMOVE',
} as const;
