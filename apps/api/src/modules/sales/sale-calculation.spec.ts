import {
  canReturnQuantity,
  cashChange,
  grossProfit,
  lineTotal,
  needsDiscountAuthorization,
  paymentBalance,
} from './sale-calculation';
describe('sale calculations', () => {
  it('calculates weighted lines and discounts', () =>
    expect(lineTotal({ quantity: 0.75, unitPrice: 2000, discountPercent: 10, discountAmount: 50 })).toBe(1300));
  it('supports combined payments without floating point residue', () =>
    expect(paymentBalance(15400, [5000, 5000, 5400])).toBe(0));
  it('calculates cash change', () => expect(cashChange(12450, 15000)).toBe(2550));
  it('keeps the historic gross profit based on the cost snapshot', () => expect(grossProfit(10000, 7000)).toBe(3000));
  it('prevents returning more than the remaining sold quantity', () => {
    expect(canReturnQuantity(3, 1, 2)).toBe(true);
    expect(canReturnQuantity(3, 1, 3)).toBe(false);
  });
  it('requires authorization above the branch discount limit', () => {
    expect(needsDiscountAuthorization(5, 5)).toBe(false);
    expect(needsDiscountAuthorization(5.01, 5)).toBe(true);
  });
});
