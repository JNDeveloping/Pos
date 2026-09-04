import { describe, expect, it } from 'vitest';
import { addProductToCart, lineSubtotal, paymentSummary, POS_SHORTCUTS, type PosProduct } from './pos-cart';
const product: PosProduct = {
  id: '1',
  branchProductId: 'b',
  name: 'Banana',
  internalCode: 'BAN',
  unitType: 'KG',
  price: '2000',
  available: 10,
  stockMinimum: 1,
  isWeighted: true,
  posFavorite: false,
  allowManualPrice: true,
};
describe('POS cart', () => {
  it('supports weighted decimal quantities and repeated scans', () => {
    const first = addProductToCart([], product, 0.85);
    expect(first[0].quantity).toBe(0.85);
    expect(addProductToCart(first, product, 0.15)[0].quantity).toBe(1);
  });
  it('calculates manual price and discounts', () => {
    expect(lineSubtotal({ ...addProductToCart([], product)[0], manualPrice: 1800, discountPercent: 10 })).toBe(1620);
  });
  it('rejects insufficient stock', () => expect(() => addProductToCart([], product, 11)).toThrow('Stock insuficiente'));
  it('keeps shortcuts centralized', () => expect(POS_SHORTCUTS.F4).toBe('PAY'));
});
describe('POS payments', () => {
  it('calculates a mixed payment', () => expect(paymentSummary(20000, [{ amount: 10000, isCash: true }, { amount: 10000, isCash: false }])).toEqual({ remaining: 0, change: 0 }));
  it('calculates cash change', () => expect(paymentSummary(8500, [{ amount: 8500, receivedAmount: 10000, isCash: true }])).toEqual({ remaining: 0, change: 1500 }));
});
