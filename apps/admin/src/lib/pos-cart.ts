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
  quantity: number;
  originalPrice: number;
  manualPrice?: number;
  discountPercent: number;
  discountAmount: number;
};
export const linePrice = (line: CartLine) => line.manualPrice ?? Number(line.price);
export const lineSubtotal = (line: CartLine) =>
  Math.max(0, linePrice(line) * line.quantity * (1 - line.discountPercent / 100) - line.discountAmount);
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
