import { Prisma, RoundingMode } from '@prisma/client';
import { markup, roundPrice } from './commercial.module';

describe('política comercial', () => {
  it('calcula precio desde margen objetivo, no desde markup', () => {
    expect(markup(1000, 40).toDecimalPlaces(2).toString()).toBe('1666.67');
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
