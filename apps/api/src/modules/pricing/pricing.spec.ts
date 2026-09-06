import { PriceCalculationService } from './pricing.module';
import { PriceUpdateMode, Prisma, PsychologicalEnding, RoundingDirection, RoundingMode } from '@prisma/client';

const rules = (roundingMode: RoundingMode, psychologicalEnding: PsychologicalEnding = PsychologicalEnding.NONE) => ({
  targetMargin: new Prisma.Decimal(30),
  roundingMode,
  roundingCustom: new Prisma.Decimal(1),
  roundingDirection: RoundingDirection.UP,
  psychologicalEnding,
  priceUpdateMode: PriceUpdateMode.SUGGEST,
});
describe('PriceCalculationService', () => {
  const service = new PriceCalculationService({} as never);
  it('diferencia margen de markup', () => {
    const price = service.calculatePriceFromCost(1000, 30);
    expect(price.toDecimalPlaces(2).toString()).toBe('1428.57');
    expect(service.calculateMargin(1000, 1450).toString()).toBe('31.03');
    expect(service.calculateMarkup(1000, 1450).toString()).toBe('45');
  });
  it.each([
    [1438, RoundingMode.MULTIPLE_50, '1450'],
    [1438, RoundingMode.MULTIPLE_100, '1500'],
  ])('redondea %s con %s hacia arriba', (value, mode, expected) => {
    expect(service.applyRounding(value, rules(mode)).toString()).toBe(expected);
  });
  it.each([
    [PsychologicalEnding.END_90, '1490'],
    [PsychologicalEnding.END_99, '1499'],
  ])('aplica terminación %s', (ending, expected) => {
    expect(service.applyRounding(1438, rules(RoundingMode.NONE, ending)).toString()).toBe(expected);
  });
  it('resuelve cada campo producto → familia → categoría → global', async () => {
    const inherited = new PriceCalculationService({
      company: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ defaultMargin: new Prisma.Decimal(20), roundingMode: RoundingMode.MULTIPLE_10 }),
      },
      companySetting: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ value: { targetMargin: '25', roundingDirection: 'UP', priceUpdateMode: 'SUGGEST' } }),
      },
      product: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            targetMargin: new Prisma.Decimal(35),
            roundingMode: null,
            family: { targetMargin: new Prisma.Decimal(30), roundingMode: RoundingMode.MULTIPLE_100 },
            category: { targetMargin: null, roundingMode: RoundingMode.MULTIPLE_50 },
          }),
      },
    } as never);
    const resolved = await inherited.resolvePricingRules('company', 'product');
    expect(resolved.targetMargin.toString()).toBe('35');
    expect(resolved.roundingMode).toBe(RoundingMode.MULTIPLE_100);
    expect(resolved.priceUpdateMode).toBe(PriceUpdateMode.SUGGEST);
  });
});
