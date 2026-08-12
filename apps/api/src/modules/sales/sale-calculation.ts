export type CalculatedLine = { quantity: number; unitPrice: number; discountPercent: number; discountAmount: number };
export function lineTotal(line: CalculatedLine) {
  const gross = line.quantity * line.unitPrice;
  return Math.round((gross - (gross * line.discountPercent) / 100 - line.discountAmount) * 100) / 100;
}
export const paymentBalance = (total: number, payments: number[]) =>
  Math.round((total - payments.reduce((sum, amount) => sum + amount, 0)) * 100) / 100;
export const cashChange = (applied: number, received: number) =>
  Math.max(0, Math.round((received - applied) * 100) / 100);
export const grossProfit = (total: number, cost: number) => Math.round((total - cost) * 100) / 100;
export const canReturnQuantity = (sold: number, previouslyReturned: number, requested: number) =>
  requested > 0 && previouslyReturned + requested <= sold;
export const needsDiscountAuthorization = (requestedPercent: number, allowedPercent: number) =>
  requestedPercent > allowedPercent;
