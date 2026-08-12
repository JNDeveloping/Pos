import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, Query, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChangeSource, Prisma, RoundingMode } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNumberString, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';

export function markup(cost: Prisma.Decimal.Value, margin: Prisma.Decimal.Value) {
  return new Prisma.Decimal(cost).mul(new Prisma.Decimal(1).plus(new Prisma.Decimal(margin).div(100)));
}
export function roundPrice(value: Prisma.Decimal.Value, mode: RoundingMode, custom?: Prisma.Decimal.Value) {
  const amount = new Prisma.Decimal(value);
  const multiple = mode === 'MULTIPLE_10' ? 10 : mode === 'MULTIPLE_50' ? 50 : mode === 'MULTIPLE_100' ? 100 : mode === 'CUSTOM' ? Number(custom ?? 1) : 0;
  if (!multiple) return amount.toDecimalPlaces(2);
  if (multiple <= 0) throw new BadRequestException('El múltiplo de redondeo debe ser mayor que cero');
  return amount.div(multiple).ceil().mul(multiple).toDecimalPlaces(2);
}

class ChangeDto {
  @IsUUID() branchId!: string;
  @IsNumberString() value!: string;
  @IsOptional() @IsBoolean() keepMargin?: boolean;
  @IsOptional() @IsEnum(RoundingMode) roundingMode?: RoundingMode;
  @IsOptional() @IsNumberString() roundingCustom?: string;
}
class BulkItemDto { @IsUUID() productId!: string; }
class BulkDto extends ChangeDto {
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => BulkItemDto) products!: BulkItemDto[];
  @IsString() operation!: 'PERCENT' | 'AMOUNT' | 'MARGIN';
}
class PriceListDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Length(2, 30) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

@Injectable()
class CommercialService {
  constructor(private db: PrismaService) {}
  async assertBranch(s: Session, branchId: string) {
    const branch = await this.db.branch.findFirst({ where: { id: branchId, companyId: s.companyId, deletedAt: null } });
    if (!branch || (s.branchId && s.branchId !== branchId)) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }
  list(s: Session, branchId: string, search = '', page = 1, costs = false) {
    if (costs && !s.permissions.includes('costs.view')) throw new ForbiddenException('No tiene permiso para ver costos');
    const where: Prisma.BranchProductWhereInput = { branchId, enabled: true, branch: { companyId: s.companyId }, product: { deletedAt: null, OR: search ? [{ name: { contains: search, mode: 'insensitive' } }, { internalCode: { contains: search, mode: 'insensitive' } }, { barcodes: { some: { barcode: { contains: search } } } }] : undefined } };
    return this.db.$transaction(async (tx) => {
      const [data, total] = await Promise.all([
        tx.branchProduct.findMany({ where, include: { product: { include: { category: true, brand: true, barcodes: { where: { isPrimary: true }, take: 1 } } } }, orderBy: { product: { name: 'asc' } }, skip: (page - 1) * 30, take: 30 }),
        tx.branchProduct.count({ where }),
      ]);
      return { data: s.permissions.includes('costs.view') ? data : data.map(({ cost: _cost, ...row }) => row), meta: { page, total, pages: Math.ceil(total / 30) } };
    });
  }
  async change(s: Session, productId: string, dto: ChangeDto, kind: 'PRICE' | 'COST', source = ChangeSource.MANUAL) {
    const branch = await this.assertBranch(s, dto.branchId);
    const current = await this.db.branchProduct.findFirst({ where: { productId, branchId: dto.branchId, product: { companyId: s.companyId } } });
    if (!current) throw new NotFoundException('Producto no habilitado en la sucursal');
    const value = new Prisma.Decimal(dto.value);
    if (value.lt(0)) throw new BadRequestException('El importe no puede ser negativo');
    const nextCost = kind === 'COST' ? value : current.cost;
    const nextPrice = kind === 'PRICE' ? value : dto.keepMargin ? roundPrice(markup(value, current.margin), dto.roundingMode ?? branch.roundingMode, dto.roundingCustom ?? branch.roundingCustom ?? 1) : current.salePrice;
    const margin = nextCost.gt(0) ? nextPrice.minus(nextCost).div(nextCost).mul(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.branchProduct.update({ where: { id: current.id }, data: { cost: nextCost, salePrice: nextPrice, margin } });
      if (!current.cost.equals(nextCost)) await tx.costHistory.create({ data: { productId, branchId: dto.branchId, oldCost: current.cost, newCost: nextCost, percentageChange: this.percent(current.cost, nextCost), source, changedByUserId: s.sub } });
      if (!current.salePrice.equals(nextPrice)) await tx.priceHistory.create({ data: { productId, branchId: dto.branchId, oldPrice: current.salePrice, newPrice: nextPrice, percentageChange: this.percent(current.salePrice, nextPrice), source: kind === 'COST' ? ChangeSource.COST_RECALCULATION : source, changedByUserId: s.sub } });
      await tx.auditLog.create({ data: { companyId: s.companyId, branchId: dto.branchId, userId: s.sub, entityType: 'BRANCH_PRODUCT', entityId: current.id, action: kind === 'PRICE' ? 'PRICE_CHANGED' : 'COST_CHANGED', before: this.json(current), after: this.json(changed) } });
      return changed;
    });
  }
  async bulk(s: Session, dto: BulkDto, kind: 'PRICE' | 'COST', preview: boolean) {
    await this.assertBranch(s, dto.branchId);
    const rows = await this.db.branchProduct.findMany({ where: { branchId: dto.branchId, productId: { in: dto.products.map((x) => x.productId) }, product: { companyId: s.companyId } }, include: { product: { select: { id: true, name: true, internalCode: true } } } });
    const amount = new Prisma.Decimal(dto.value);
    const changes = rows.map((row) => {
      const base = kind === 'PRICE' ? row.salePrice : row.cost;
      const raw = dto.operation === 'PERCENT' ? base.mul(new Prisma.Decimal(1).plus(amount.div(100))) : dto.operation === 'MARGIN' ? markup(row.cost, amount) : base.plus(amount);
      const next = kind === 'PRICE' ? roundPrice(raw, dto.roundingMode ?? RoundingMode.NONE, dto.roundingCustom) : raw.toDecimalPlaces(2);
      const nextCost = kind === 'COST' ? next : row.cost;
      const nextPrice = kind === 'COST' && dto.keepMargin ? roundPrice(markup(next, row.margin), dto.roundingMode ?? RoundingMode.NONE, dto.roundingCustom) : kind === 'PRICE' ? next : row.salePrice;
      return { row, nextCost, nextPrice, margin: nextCost.gt(0) ? nextPrice.minus(nextCost).div(nextCost).mul(100).toDecimalPlaces(2) : new Prisma.Decimal(0) };
    });
    if (preview) return changes.map(({ row, nextCost, nextPrice, margin }) => ({ productId: row.productId, code: row.product.internalCode, name: row.product.name, oldCost: row.cost, newCost: nextCost, oldPrice: row.salePrice, newPrice: nextPrice, oldMargin: row.margin, newMargin: margin }));
    return this.db.$transaction(async (tx) => {
      for (const { row, nextCost, nextPrice, margin } of changes) {
        await tx.branchProduct.update({ where: { id: row.id }, data: { cost: nextCost, salePrice: nextPrice, margin } });
        if (!row.cost.equals(nextCost)) await tx.costHistory.create({ data: { productId: row.productId, branchId: dto.branchId, oldCost: row.cost, newCost: nextCost, percentageChange: this.percent(row.cost, nextCost), source: ChangeSource.BULK_UPDATE, changedByUserId: s.sub } });
        if (!row.salePrice.equals(nextPrice)) await tx.priceHistory.create({ data: { productId: row.productId, branchId: dto.branchId, oldPrice: row.salePrice, newPrice: nextPrice, percentageChange: this.percent(row.salePrice, nextPrice), source: ChangeSource.BULK_UPDATE, changedByUserId: s.sub } });
      }
      await tx.auditLog.create({ data: { companyId: s.companyId, branchId: dto.branchId, userId: s.sub, entityType: 'BRANCH', entityId: dto.branchId, action: kind === 'PRICE' ? 'BULK_PRICE_UPDATE' : 'BULK_COST_UPDATE', metadata: { products: changes.length, operation: dto.operation, value: dto.value } } });
      return { updated: changes.length };
    });
  }
  private percent(oldValue: Prisma.Decimal, newValue: Prisma.Decimal) { return oldValue.eq(0) ? new Prisma.Decimal(0) : newValue.minus(oldValue).div(oldValue).mul(100).toDecimalPlaces(2); }
  private json(value: unknown) { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
}

@Controller('prices')
class PricesController {
  constructor(private service: CommercialService) {}
  @Get() @RequirePermissions('prices.view') list(@CurrentSession() s: Session, @Query('branchId') branchId: string, @Query('search') search?: string, @Query('page') page?: string) { return this.service.list(s, branchId, search, Number(page || 1)); }
  @Patch(':productId') @RequirePermissions('prices.update') change(@CurrentSession() s: Session, @Param('productId') id: string, @Body() dto: ChangeDto) { return this.service.change(s, id, dto, 'PRICE'); }
  @Post('bulk/preview') @RequirePermissions('prices.bulkUpdate') preview(@CurrentSession() s: Session, @Body() dto: BulkDto) { return this.service.bulk(s, dto, 'PRICE', true); }
  @Post('bulk/apply') @RequirePermissions('prices.bulkUpdate') bulk(@CurrentSession() s: Session, @Body() dto: BulkDto) { return this.service.bulk(s, dto, 'PRICE', false); }
}
@Controller('costs')
class CostsController {
  constructor(private service: CommercialService) {}
  @Get() @RequirePermissions('costs.view') list(@CurrentSession() s: Session, @Query('branchId') branchId: string, @Query('search') search?: string, @Query('page') page?: string) { return this.service.list(s, branchId, search, Number(page || 1), true); }
  @Patch(':productId') @RequirePermissions('costs.update') change(@CurrentSession() s: Session, @Param('productId') id: string, @Body() dto: ChangeDto) { return this.service.change(s, id, dto, 'COST'); }
  @Post('bulk/preview') @RequirePermissions('costs.bulkUpdate') preview(@CurrentSession() s: Session, @Body() dto: BulkDto) { return this.service.bulk(s, dto, 'COST', true); }
  @Post('bulk/apply') @RequirePermissions('costs.bulkUpdate') bulk(@CurrentSession() s: Session, @Body() dto: BulkDto) { return this.service.bulk(s, dto, 'COST', false); }
}
@Controller('price-lists')
class PriceListsController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('priceLists.view') list(@CurrentSession() s: Session) { return this.db.priceList.findMany({ where: { companyId: s.companyId }, include: { _count: { select: { items: true } } }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }); }
  @Post() @RequirePermissions('priceLists.manage') create(@CurrentSession() s: Session, @Body() dto: PriceListDto) { return this.db.$transaction(async (tx) => { if (dto.isDefault) await tx.priceList.updateMany({ where: { companyId: s.companyId }, data: { isDefault: false } }); const list = await tx.priceList.create({ data: { ...dto, code: dto.code.toUpperCase(), companyId: s.companyId } }); await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRICE_LIST', entityId: list.id, action: 'PRICE_LIST_CREATED', after: JSON.parse(JSON.stringify(list)) } }); return list; }); }
  @Patch(':id') @RequirePermissions('priceLists.manage') update(@CurrentSession() s: Session, @Param('id') id: string, @Body() dto: Partial<PriceListDto>) { return this.db.$transaction(async (tx) => { const current = await tx.priceList.findFirst({ where: { id, companyId: s.companyId } }); if (!current) throw new NotFoundException('Lista no encontrada'); if (dto.isDefault) await tx.priceList.updateMany({ where: { companyId: s.companyId }, data: { isDefault: false } }); const list = await tx.priceList.update({ where: { id }, data: { ...dto, code: dto.code?.toUpperCase() } }); await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRICE_LIST', entityId: id, action: 'PRICE_LIST_UPDATED', before: JSON.parse(JSON.stringify(current)), after: JSON.parse(JSON.stringify(list)) } }); return list; }); }
}
@Module({ controllers: [PricesController, CostsController, PriceListsController], providers: [CommercialService] })
export class CommercialModule {}
