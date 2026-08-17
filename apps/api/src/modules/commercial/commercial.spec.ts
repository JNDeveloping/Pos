import { Prisma, RoundingMode } from '@prisma/client';
import { markup, roundPrice } from './commercial.module';

describe('política comercial', () => {
  it('calcula markup sobre costo de forma consistente', () => {
    expect(markup(1000, 40).toString()).toBe('1400');
  });
  it.each([
    [RoundingMode.NONE, '1347', '1347'],
    [RoundingMode.MULTIPLE_10, '1347', '1350'],
    [RoundingMode.MULTIPLE_50, '1347', '1350'],
    [RoundingMode.MULTIPLE_100, '1347', '1400'],
  ])('aplica redondeo %s', (mode, input, expected) => {
    expect(roundPrice(new Prisma.Decimal(input), mode).toString()).toBe(expected);
  });
  it('acepta múltiplo personalizado', () => {
    expect(roundPrice(1347, RoundingMode.CUSTOM, 25).toString()).toBe('1350');
  });
});
