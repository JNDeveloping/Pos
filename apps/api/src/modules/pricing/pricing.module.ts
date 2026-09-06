import { BadRequestException, Body, Controller, Get, Global, Injectable, Module, Put, Query } from '@nestjs/common';
import { PriceUpdateMode, Prisma, PsychologicalEnding, RoundingDirection, RoundingMode } from '@prisma/client';
import { IsEnum, IsNumberString, IsOptional, IsUUID } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';

export type PricingRules = {
  targetMargin: Prisma.Decimal;
  roundingMode: RoundingMode;
  roundingCustom?: Prisma.Decimal;
  roundingDirection: RoundingDirection;
  psychologicalEnding: PsychologicalEnding;
  priceUpdateMode: PriceUpdateMode;
};

class PricingRulesDto {
  @IsNumberString() targetMargin!: string;
  @IsEnum(RoundingMode) roundingMode!: RoundingMode;
  @IsOptional() @IsNumberString() roundingCustom?: string;
  @IsEnum(RoundingDirection) roundingDirection!: RoundingDirection;
  @IsEnum(PsychologicalEnding) psychologicalEnding!: PsychologicalEnding;
  @IsEnum(PriceUpdateMode) priceUpdateMode!: PriceUpdateMode;
}
class QuoteDto {
  @IsNumberString() cost!: string;
  @IsOptional() @IsNumberString() finalPrice?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsNumberString() targetMargin?: string;
  @IsOptional() @IsEnum(RoundingMode) roundingMode?: RoundingMode;
  @IsOptional() @IsNumberString() roundingCustom?: string;
  @IsOptional() @IsEnum(RoundingDirection) roundingDirection?: RoundingDirection;
  @IsOptional() @IsEnum(PsychologicalEnding) psychologicalEnding?: PsychologicalEnding;
}

@Injectable()
export class PriceCalculationService {
  constructor(private db: PrismaService) {}

  calculatePriceFromCost(costValue: Prisma.Decimal.Value, marginValue: Prisma.Decimal.Value) {
    const cost = new Prisma.Decimal(costValue),
      margin = new Prisma.Decimal(marginValue);
    if (cost.lt(0)) throw new BadRequestException('El costo no puede ser negativo');
    if (margin.lt(0) || margin.gte(100))
      throw new BadRequestException('El margen objetivo debe estar entre 0 y 99,99%');
    return cost.div(new Prisma.Decimal(1).minus(margin.div(100)));
  }
  calculateMargin(costValue: Prisma.Decimal.Value, priceValue: Prisma.Decimal.Value) {
    const cost = new Prisma.Decimal(costValue),
      price = new Prisma.Decimal(priceValue);
    return price.gt(0) ? price.minus(cost).div(price).mul(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
  }
  calculateMarkup(costValue: Prisma.Decimal.Value, priceValue: Prisma.Decimal.Value) {
    const cost = new Prisma.Decimal(costValue),
      price = new Prisma.Decimal(priceValue);
    return cost.gt(0) ? price.minus(cost).div(cost).mul(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
  }
  applyRounding(
    value: Prisma.Decimal.Value,
    rules: Pick<PricingRules, 'roundingMode' | 'roundingCustom' | 'roundingDirection' | 'psychologicalEnding'>,
  ) {
    let result = new Prisma.Decimal(value);
    const multiples: Partial<Record<RoundingMode, number>> = {
      MULTIPLE_10: 10,
      MULTIPLE_50: 50,
      MULTIPLE_100: 100,
      MULTIPLE_500: 500,
      MULTIPLE_1000: 1000,
    };
    const multiple =
      rules.roundingMode === RoundingMode.CUSTOM
        ? Number(rules.roundingCustom ?? 0)
        : (multiples[rules.roundingMode] ?? 0);
    if (rules.roundingMode === RoundingMode.CUSTOM && multiple <= 0)
      throw new BadRequestException('El múltiplo personalizado debe ser mayor que cero');
    if (multiple > 0) {
      const units = result.div(multiple);
      result = (rules.roundingDirection === RoundingDirection.NEAREST ? units.round() : units.ceil()).mul(multiple);
    }
    if (rules.psychologicalEnding !== PsychologicalEnding.NONE) {
      const ending = { END_00: 0, END_50: 50, END_90: 90, END_99: 99 }[rules.psychologicalEnding];
      let candidate = result.div(100).floor().mul(100).plus(ending);
      if (candidate.lt(result)) candidate = candidate.plus(100);
      result = candidate;
    }
    return result.toDecimalPlaces(2);
  }
  async resolvePricingRules(companyId: string, productId?: string): Promise<PricingRules> {
    const [company, setting, product] = await Promise.all([
      this.db.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { defaultMargin: true, roundingMode: true },
      }),
      this.db.companySetting.findUnique({ where: { companyId_key: { companyId, key: 'pricing' } } }),
      productId
        ? this.db.product.findFirst({ where: { id: productId, companyId }, include: { family: true, category: true } })
        : null,
    ]);
    if (productId && !product) throw new BadRequestException('Producto inválido');
    const global = (setting?.value ?? {}) as Record<string, string>;
    const levels = [product?.category, product?.family, product].filter(Boolean) as Array<Record<string, unknown>>;
    const inherited = <T>(key: string, fallback: T) =>
      levels.reduce((value, level) => (level[key] ?? value) as T, fallback);
    return {
      targetMargin: new Prisma.Decimal(inherited('targetMargin', global.targetMargin ?? company.defaultMargin)),
      roundingMode: inherited('roundingMode', (global.roundingMode as RoundingMode) ?? company.roundingMode),
      roundingCustom: new Prisma.Decimal(inherited('roundingCustom', global.roundingCustom ?? 1)),
      roundingDirection: inherited(
        'roundingDirection',
        (global.roundingDirection as RoundingDirection) ?? RoundingDirection.UP,
      ),
      psychologicalEnding: inherited(
        'psychologicalEnding',
        (global.psychologicalEnding as PsychologicalEnding) ?? PsychologicalEnding.NONE,
      ),
      priceUpdateMode: inherited(
        'priceUpdateMode',
        (global.priceUpdateMode as PriceUpdateMode) ?? PriceUpdateMode.SUGGEST,
      ),
    };
  }
  async quote(companyId: string, dto: QuoteDto) {
    const inherited = await this.resolvePricingRules(companyId, dto.productId);
    const rules: PricingRules = {
      ...inherited,
      ...(dto.targetMargin !== undefined ? { targetMargin: new Prisma.Decimal(dto.targetMargin) } : {}),
      ...(dto.roundingMode ? { roundingMode: dto.roundingMode } : {}),
      ...(dto.roundingCustom ? { roundingCustom: new Prisma.Decimal(dto.roundingCustom) } : {}),
      ...(dto.roundingDirection ? { roundingDirection: dto.roundingDirection } : {}),
      ...(dto.psychologicalEnding ? { psychologicalEnding: dto.psychologicalEnding } : {}),
    };
    const cost = new Prisma.Decimal(dto.cost),
      calculatedPrice = this.calculatePriceFromCost(cost, rules.targetMargin),
      suggestedPrice = this.applyRounding(calculatedPrice, rules),
      finalPrice = dto.finalPrice === undefined ? suggestedPrice : new Prisma.Decimal(dto.finalPrice);
    return {
      cost,
      targetMargin: rules.targetMargin,
      calculatedPrice: calculatedPrice.toDecimalPlaces(2),
      suggestedPrice,
      finalPrice,
      actualMargin: this.calculateMargin(cost, finalPrice),
      actualMarkup: this.calculateMarkup(cost, finalPrice),
      priceUpdateMode: rules.priceUpdateMode,
      roundingRule: this.ruleSnapshot(rules),
    };
  }
  ruleSnapshot(rules: PricingRules) {
    return JSON.stringify({
      roundingMode: rules.roundingMode,
      roundingCustom: rules.roundingCustom?.toString(),
      roundingDirection: rules.roundingDirection,
      psychologicalEnding: rules.psychologicalEnding,
    });
  }
}

@Controller('pricing')
class PricingController {
  constructor(
    private db: PrismaService,
    private pricing: PriceCalculationService,
  ) {}
  @Get('rules') @RequirePermissions('branches.settings') async rules(@CurrentSession() s: Session) {
    return this.pricing.resolvePricingRules(s.companyId);
  }
  @Put('rules') @RequirePermissions('branches.settings') async save(
    @CurrentSession() s: Session,
    @Body() dto: PricingRulesDto,
  ) {
    await this.pricing.quote(s.companyId, { cost: '1', ...dto });
    const value = { ...dto } as unknown as Prisma.InputJsonValue;
    await this.db.companySetting.upsert({
      where: { companyId_key: { companyId: s.companyId, key: 'pricing' } },
      create: { companyId: s.companyId, key: 'pricing', value },
      update: { value },
    });
    return dto;
  }
  @Get('quote') @RequirePermissions('products.view') quote(@CurrentSession() s: Session, @Query() dto: QuoteDto) {
    return this.pricing.quote(s.companyId, dto);
  }
}

@Global()
@Module({ controllers: [PricingController], providers: [PriceCalculationService], exports: [PriceCalculationService] })
export class PricingModule {}
