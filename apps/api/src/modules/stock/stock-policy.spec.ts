import { aggregatePurchaseUnits, availableStock, nextStock, stockStatus } from './stock-policy';

describe('stock policy', () => {
  it('increases, decreases and calculates available stock', () => {
    expect(nextStock(10, 5)).toBe(15);
    expect(nextStock(10, -4)).toBe(6);
    expect(availableStock(10, 3)).toBe(7);
  });
  it('rejects negative stock unless the branch allows it', () => {
    expect(() => nextStock(1, -2)).toThrow('Stock insuficiente');
    expect(nextStock(1, -2, true)).toBe(-1);
  });
  it('returns accessible status labels', () => {
    expect(stockStatus(0, 2)).toBe('OUT_OF_STOCK');
    expect(stockStatus(2, 2)).toBe('LOW');
    expect(stockStatus(3, 2)).toBe('NORMAL');
  });
  it('aggregates duplicate purchase lines before the idempotent receipt', () => {
    expect(
      aggregatePurchaseUnits([
        { productId: 'cola', totalUnits: 12 },
        { productId: 'cola', totalUnits: 6 },
      ]).get('cola'),
    ).toBe(18);
  });
});
