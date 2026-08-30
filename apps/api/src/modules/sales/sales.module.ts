import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma, SaleStatus, StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
import { StockModule, StockService } from '../stock/stock.module';

class SaleLineDto {
  @IsUUID() productId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) manualPrice?: number;
  @IsOptional() @IsNumber() @Min(0) expectedUnitPrice?: number;
}
class PaymentDto {
  @IsUUID() paymentMethodId!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsNumber() @Min(0) receivedAmount?: number;
  @IsOptional() @IsString() reference?: string;
}
class SaleDto {
  @IsUUID() operationId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() terminalId!: string;
  @IsOptional() @IsUUID() priceListId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleLineDto) items!: SaleLineDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentDto) payments!: PaymentDto[];
  @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
}
class CancelDto {
  @IsString() @MinLength(3) reason!: string;
}
class ReturnLineDto {
  @IsUUID() saleItemId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsBoolean() returnToStock?: boolean;
}
class ReturnDto {
  @IsString() @MinLength(3) reason!: string;
  @IsOptional() @IsString() refundMethod?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReturnLineDto) items!: ReturnLineDto[];
}
class ConfigDto {
  @IsString() @MinLength(2) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() requiresReference?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
class TerminalDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class PriceResolutionService {
  constructor(private db: PrismaService) {}
  async resolve(tx: Prisma.TransactionClient, s: Session, branchId: string, productId: string, priceListId?: string) {
    const config = await tx.branchProduct.findUnique({
      where: { branchId_productId: { branchId, productId } },
      include: { product: { include: { barcodes: true } } },
    });
    if (!config?.enabled || !config.product.active)
      throw new BadRequestException('Este producto no está habilitado para esta sucursal');
    let price = config.salePrice;
    const branch = await tx.branch.findFirst({
      where: { id: branchId, companyId: s.companyId, active: true, deletedAt: null },
      select: { defaultPriceListId: true },
    });
    if (!branch) throw new BadRequestException('Sucursal inválida');
    const effectivePriceListId = priceListId ?? branch.defaultPriceListId;
    if (effectivePriceListId) {
      const list = await tx.priceListItem.findUnique({
        where: { priceListId_branchId_productId: { priceListId: effectivePriceListId, productId, branchId } },
      });
      if (list) price = list.price;
    }
    if (price.lte(0)) throw new BadRequestException(`El producto ${config.product.name} no tiene precio de venta`);
    return { config, price };
  }
}

@Injectable()
class SalesService {
  constructor(
    private db: PrismaService,
    private stock: StockService,
    private prices: PriceResolutionService,
  ) {}
  async create(s: Session, dto: SaleDto) {
    const previous = await this.db.sale.findUnique({
      where: { operationId: dto.operationId },
      include: { items: true, payments: { include: { paymentMethod: true } } },
    });
    if (previous) {
      if (previous.companyId !== s.companyId) throw new BadRequestException('operationId ya utilizado');
      return this.visible(s, previous);
    }
    if (!dto.items.length) throw new BadRequestException('La venta no tiene productos');
    if (new Set(dto.items.map((item) => item.productId)).size !== dto.items.length)
      throw new BadRequestException('Un producto no puede repetirse en varias líneas');
    return this.db.$transaction(
      async (tx) => {
        const branch = await tx.branch.findFirst({ where: { id: dto.branchId, companyId: s.companyId, active: true } });
        const terminal = await tx.terminal.findFirst({
          where: { id: dto.terminalId, branchId: dto.branchId, companyId: s.companyId, active: true },
        });
        if (!branch || !terminal || (s.branchId && s.branchId !== dto.branchId))
          throw new BadRequestException('Sucursal o terminal inválida');
        const lines = [];
        for (const input of dto.items) {
          const { config, price: resolved } = await this.prices.resolve(
            tx,
            s,
            dto.branchId,
            input.productId,
            dto.priceListId,
          );
          if (input.expectedUnitPrice !== undefined && !resolved.equals(input.expectedUnitPrice))
            throw new BadRequestException(`El precio de ${config.product.name} cambió a ${resolved.toFixed(2)}`);
          let price = resolved;
          if (input.manualPrice !== undefined) {
            if (!s.permissions.includes('sales.manualPrice') && !s.roles.includes('SUPER_ADMIN'))
              throw new BadRequestException('No tiene permiso para precio manual');
            if (!(config.allowManualPrice ?? config.product.allowManualPriceDefault))
              throw new BadRequestException('El producto no admite precio manual');
            price = new Prisma.Decimal(input.manualPrice);
          }
          const pct = new Prisma.Decimal(input.discountPercent ?? 0),
            amount = new Prisma.Decimal(input.discountAmount ?? 0);
          if (
            (pct.gt(0) || amount.gt(0)) &&
            !s.permissions.includes('sales.discountItem') &&
            !s.roles.includes('SUPER_ADMIN')
          )
            throw new BadRequestException('No tiene permiso para descuento por ítem');
          const gross = price.mul(input.quantity),
            subtotal = gross.mul(new Prisma.Decimal(1).minus(pct.div(100))).minus(amount);
          if (subtotal.lt(0)) throw new BadRequestException('Descuento inválido');
          lines.push({ input, config, price, originalPrice: resolved, pct, amount, subtotal });
        }
        const subtotal = lines.reduce((sum, l) => sum.plus(l.subtotal), new Prisma.Decimal(0));
        const salePct = new Prisma.Decimal(dto.discountPercent ?? 0);
        if (salePct.gt(0) && !s.permissions.includes('sales.discountSale') && !s.roles.includes('SUPER_ADMIN'))
          throw new BadRequestException('No tiene permiso para descuento general');
        if (
          salePct.gt(branch.maxDiscountWithoutAuthorization) &&
          !s.permissions.includes('sales.authorizeDiscount') &&
          !s.roles.includes('SUPER_ADMIN')
        )
          throw new BadRequestException('El descuento requiere autorización');
        const discountTotal = subtotal.mul(salePct).div(100),
          total = subtotal.minus(discountTotal).toDecimalPlaces(2);
        const methods = await tx.paymentMethod.findMany({
          where: { id: { in: dto.payments.map((p) => p.paymentMethodId) }, companyId: s.companyId, active: true },
        });
        if (methods.length !== new Set(dto.payments.map((p) => p.paymentMethodId)).size)
          throw new BadRequestException('Medio de pago inválido');
        const paid = dto.payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0)).toDecimalPlaces(2);
        if (!paid.equals(total)) throw new BadRequestException(`Los pagos deben sumar ${total.toFixed(2)}`);
        for (const payment of dto.payments) {
          const method = methods.find((m) => m.id === payment.paymentMethodId)!;
          if (method.requiresReference && !payment.reference)
            throw new BadRequestException(`${method.name} requiere referencia`);
          if (method.code === 'CASH' && (payment.receivedAmount ?? payment.amount) < payment.amount)
            throw new BadRequestException('Efectivo recibido insuficiente');
        }
        const numbered = await tx.terminal.update({
          where: { id: terminal.id },
          data: { nextSaleNumber: { increment: 1 } },
        });
        const saleNumber = `${branch.code}-${terminal.code}-${String(numbered.nextSaleNumber).padStart(8, '0')}`;
        const costTotal = lines.reduce(
          (sum, l) => sum.plus(l.config.cost.mul(l.input.quantity)),
          new Prisma.Decimal(0),
        );
        const sale = await tx.sale.create({
          data: {
            operationId: dto.operationId,
            companyId: s.companyId,
            branchId: dto.branchId,
            terminalId: dto.terminalId,
            userId: s.sub,
            saleNumber,
            status: SaleStatus.COMPLETED,
            priceListId: dto.priceListId,
            subtotal,
            discountTotal,
            total,
            costTotal,
            grossProfit: total.minus(costTotal),
            completedAt: new Date(),
            items: {
              create: lines.map((l) => ({
                productId: l.input.productId,
                branchProductId: l.config.id,
                productNameSnapshot: l.config.product.name,
                barcodeSnapshot: l.config.product.barcodes.find((b) => b.isPrimary)?.barcode,
                quantity: l.input.quantity,
                unitPrice: l.price,
                originalUnitPrice: l.originalPrice,
                costSnapshot: l.config.cost,
                discountPercent: l.pct,
                discountAmount: l.amount,
                subtotal: l.subtotal,
                taxRateSnapshot: l.config.product.taxRate,
              })),
            },
            payments: {
              create: dto.payments.map((p) => {
                const method = methods.find((m) => m.id === p.paymentMethodId)!;
                const received = new Prisma.Decimal(p.receivedAmount ?? p.amount);
                return {
                  paymentMethodId: p.paymentMethodId,
                  amount: p.amount,
                  receivedAmount: method.code === 'CASH' ? received : undefined,
                  changeAmount: method.code === 'CASH' ? received.minus(p.amount) : undefined,
                  reference: p.reference,
                };
              }),
            },
          },
          include: { items: true, payments: { include: { paymentMethod: true } } },
        });
        for (const l of lines)
          await this.stock.change(
            tx,
            s,
            dto.branchId,
            l.input.productId,
            -l.input.quantity,
            StockMovementType.SALE,
            `Venta ${saleNumber}`,
            'SALE',
            sale.id,
          );
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            branchId: dto.branchId,
            userId: s.sub,
            entityType: 'SALE',
            entityId: sale.id,
            action: 'SALE_COMPLETED',
            metadata: { saleNumber, total: total.toString() },
          },
        });
        if (salePct.gt(0) || lines.some((line) => line.pct.gt(0) || line.amount.gt(0)))
          await tx.auditLog.create({
            data: {
              companyId: s.companyId,
              branchId: dto.branchId,
              userId: s.sub,
              entityType: 'SALE',
              entityId: sale.id,
              action: 'SALE_DISCOUNT_APPLIED',
              metadata: { salePercent: salePct.toString() },
            },
          });
        if (lines.some((line) => line.input.manualPrice !== undefined))
          await tx.auditLog.create({
            data: {
              companyId: s.companyId,
              branchId: dto.branchId,
              userId: s.sub,
              entityType: 'SALE',
              entityId: sale.id,
              action: 'SALE_MANUAL_PRICE',
            },
          });
        return this.visible(s, sale);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  visible(s: Session, sale: any) {
    if (s.roles.includes('SUPER_ADMIN') || s.permissions.includes('costs.view')) return sale;
    return Object.fromEntries(Object.entries(sale).filter(([key]) => key !== 'costTotal' && key !== 'grossProfit'));
  }
  async list(s: Session, q = '') {
    const rows = await this.db.sale.findMany({
      where: { companyId: s.companyId, branchId: s.branchId ?? undefined, saleNumber: q ? { contains: q } : undefined },
      include: { _count: { select: { items: true } }, payments: { include: { paymentMethod: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((x) => this.visible(s, x));
  }
  async get(s: Session, id: string) {
    const sale = await this.db.sale.findFirst({
      where: { id, companyId: s.companyId },
      include: { items: true, payments: { include: { paymentMethod: true } }, returns: { include: { items: true } } },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return this.visible(s, sale);
  }
  async cancel(s: Session, id: string, reason: string) {
    return this.db.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, companyId: s.companyId, status: SaleStatus.COMPLETED },
          include: { items: true },
        });
        if (!sale) throw new BadRequestException('Venta no anulable');
        for (const item of sale.items)
          await this.stock.change(
            tx,
            s,
            sale.branchId,
            item.productId,
            Number(item.quantity),
            StockMovementType.SALE_RETURN,
            `Anulación ${sale.saleNumber}`,
            'SALE_CANCEL',
            sale.id,
          );
        const row = await tx.sale.update({
          where: { id },
          data: {
            status: SaleStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledByUserId: s.sub,
            cancellationReason: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            branchId: sale.branchId,
            userId: s.sub,
            entityType: 'SALE',
            entityId: id,
            action: 'SALE_CANCELLED',
            metadata: { reason },
          },
        });
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async return(s: Session, id: string, dto: ReturnDto) {
    return this.db.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, companyId: s.companyId, status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] } },
          include: { items: { include: { returnItems: true } } },
        });
        if (!sale) throw new BadRequestException('Venta no admite devolución');
        const data: Array<{
          item: (typeof sale.items)[number];
          input: ReturnLineDto;
          amount: Prisma.Decimal;
        }> = [];
        for (const input of dto.items) {
          const item = sale.items.find((i) => i.id === input.saleItemId);
          if (!item) throw new BadRequestException('Ítem inválido');
          const returned = item.returnItems.reduce((n, r) => n + Number(r.quantity), 0);
          if (returned + input.quantity > Number(item.quantity))
            throw new BadRequestException('La devolución supera lo vendido');
          data.push({ item, input, amount: item.unitPrice.mul(input.quantity) });
        }
        const total = data.reduce((n, x) => n.plus(x.amount), new Prisma.Decimal(0));
        const ret = await tx.saleReturn.create({
          data: {
            saleId: id,
            branchId: sale.branchId,
            userId: s.sub,
            reason: dto.reason,
            refundMethod: dto.refundMethod,
            total,
            items: {
              create: data.map((x) => ({
                saleItemId: x.item.id,
                productId: x.item.productId,
                quantity: x.input.quantity,
                unitPrice: x.item.unitPrice,
                amount: x.amount,
                returnToStock: x.input.returnToStock ?? true,
              })),
            },
          },
          include: { items: true },
        });
        for (const x of data)
          if (x.input.returnToStock ?? true)
            await this.stock.change(
              tx,
              s,
              sale.branchId,
              x.item.productId,
              x.input.quantity,
              StockMovementType.SALE_RETURN,
              `Devolución ${sale.saleNumber}`,
              'SALE_RETURN',
              ret.id,
            );
        const allReturned = sale.items.every(
          (item) =>
            item.returnItems.reduce((n, r) => n + Number(r.quantity), 0) +
              (data.find((x) => x.item.id === item.id)?.input.quantity ?? 0) >=
            Number(item.quantity),
        );
        await tx.sale.update({
          where: { id },
          data: { status: allReturned ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED },
        });
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            branchId: sale.branchId,
            userId: s.sub,
            entityType: 'SALE_RETURN',
            entityId: ret.id,
            action: 'SALE_RETURN_CREATED',
            metadata: { saleId: id, total: total.toString() },
          },
        });
        return ret;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async reprint(s: Session, id: string) {
    const sale = await this.get(s, id);
    await this.db.auditLog.create({
      data: {
        companyId: s.companyId,
        branchId: sale.branchId,
        userId: s.sub,
        entityType: 'SALE',
        entityId: id,
        action: 'SALE_TICKET_REPRINTED',
      },
    });
    return sale;
  }
}

type PosProduct = {
  id: string;
  branchProductId: string;
  name: string;
  shortName: string | null;
  internalCode: string;
  barcode?: string;
  brand?: string;
  categoryId: string;
  category: string;
  presentation?: string;
  unitType: string;
  price: Prisma.Decimal;
  available: number;
  stockMinimum: number;
  location?: string;
  isWeighted: boolean;
  posFavorite: boolean;
  allowManualPrice: boolean;
  allowNegativeStock: boolean;
};

@Injectable()
export class PosCatalogService {
  constructor(private db: PrismaService) {}

  private async branch(s: Session, branchId: string) {
    if (!branchId || (s.branchId && s.branchId !== branchId)) throw new BadRequestException('Sucursal inválida');
    const branch = await this.db.branch.findFirst({
      where: { id: branchId, companyId: s.companyId, active: true, deletedAt: null },
      select: { allowNegativeStock: true, defaultPriceListId: true },
    });
    if (!branch) throw new BadRequestException('Sucursal inválida');
    return branch;
  }

  private async resolve(s: Session, branchId: string, where: Prisma.ProductWhereInput, exactLabel?: string) {
    const branch = await this.branch(s, branchId);
    const products = await this.db.product.findMany({
      where: { companyId: s.companyId, deletedAt: null, ...where },
      include: { brand: true, category: true, barcodes: true, branchConfigs: { where: { branchId } } },
      orderBy: { name: 'asc' },
      take: exactLabel ? 2 : 30,
    });
    if (exactLabel && !products.length) throw new NotFoundException(`El código ${exactLabel} no está registrado`);
    const exact = exactLabel ? products[0] : undefined;
    if (exact && !exact.active) throw new BadRequestException('El producto está desactivado');
    if (exact && !exact.branchConfigs[0]?.enabled)
      throw new BadRequestException('El producto existe pero no está habilitado para esta sucursal');
    const ids = products.map((product) => product.id);
    const [stocks, listPrices] = await Promise.all([
      this.db.stock.findMany({ where: { branchId, productId: { in: ids } } }),
      branch.defaultPriceListId
        ? this.db.priceListItem.findMany({
            where: { priceListId: branch.defaultPriceListId, branchId, productId: { in: ids } },
          })
        : [],
    ]);
    const stockByProduct = new Map(stocks.map((stock) => [stock.productId, stock]));
    const priceByProduct = new Map(listPrices.map((price) => [price.productId, price.price]));
    const result: PosProduct[] = products
      .filter((product) => product.active && product.branchConfigs[0]?.enabled)
      .map((product) => {
        const config = product.branchConfigs[0];
        const stock = stockByProduct.get(product.id);
        return {
          id: product.id,
          branchProductId: config.id,
          name: product.name,
          shortName: product.shortName,
          internalCode: product.internalCode,
          barcode: product.barcodes.find((barcode) => barcode.isPrimary)?.barcode ?? product.barcodes[0]?.barcode,
          brand: product.brand?.name,
          categoryId: product.categoryId,
          category: product.category.name,
          presentation: product.presentationType ?? undefined,
          unitType: product.unitType,
          price: priceByProduct.get(product.id) ?? config.salePrice,
          available: Number(stock?.quantity ?? 0) - Number(stock?.reservedQuantity ?? 0),
          stockMinimum: Number(config.stockMinimum),
          location: config.location ?? undefined,
          isWeighted: product.isWeighted,
          posFavorite: config.posFavorite,
          allowManualPrice: config.allowManualPrice ?? product.allowManualPriceDefault,
          allowNegativeStock: branch.allowNegativeStock,
        };
      });
    if (exact) {
      const item = result[0];
      if (!item) throw new BadRequestException('El producto no está disponible para la venta');
      if (item.price.lte(0)) throw new BadRequestException('Producto sin precio');
      if (item.available <= 0 && !branch.allowNegativeStock) throw new BadRequestException('Producto sin stock');
    }
    return result.filter((item) => item.price.gt(0));
  }

  byBarcode(s: Session, branchId: string, barcode: string) {
    if (!/^\d{3,64}$/.test(barcode)) throw new BadRequestException('Código de barras inválido');
    return this.resolve(s, branchId, { barcodes: { some: { barcode } } }, barcode).then((items) => items[0]);
  }

  async search(s: Session, branchId: string, query: string) {
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('Ingresá al menos 2 caracteres');
    const exactCode = await this.db.product.findFirst({
      where: { companyId: s.companyId, deletedAt: null, internalCode: { equals: q, mode: 'insensitive' } },
      select: { id: true },
    });
    return this.resolve(
      s,
      branchId,
      exactCode
        ? { id: exactCode.id }
        : {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { shortName: { contains: q, mode: 'insensitive' } },
              { internalCode: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { brand: { name: { contains: q, mode: 'insensitive' } } },
              { barcodes: { some: { barcode: q } } },
            ],
          },
      exactCode ? q : undefined,
    );
  }

  favorites(s: Session, branchId: string) {
    return this.resolve(s, branchId, { branchConfigs: { some: { branchId, enabled: true, posFavorite: true } } });
  }

  async quickGroups(s: Session, branchId: string) {
    await this.branch(s, branchId);
    return this.db.category.findMany({
      where: {
        companyId: s.companyId,
        active: true,
        deletedAt: null,
        products: { some: { active: true, deletedAt: null, branchConfigs: { some: { branchId, enabled: true } } } },
      },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 16,
    });
  }

  category(s: Session, branchId: string, categoryId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(categoryId)) throw new BadRequestException('Categoría inválida');
    return this.resolve(s, branchId, { categoryId });
  }
}

@Controller('pos/products')
class PosController {
  constructor(private catalog: PosCatalogService) {}
  @Get('by-barcode/:barcode') @RequirePermissions('sales.access') byBarcode(
    @CurrentSession() s: Session,
    @Param('barcode') barcode: string,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.byBarcode(s, branchId, barcode);
  }
  @Get('search') @RequirePermissions('sales.access') search(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string,
    @Query('q') q = '',
  ) {
    return this.catalog.search(s, branchId, q);
  }
  @Get('favorites') @RequirePermissions('sales.access') favorites(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.favorites(s, branchId);
  }
  @Get('quick-groups') @RequirePermissions('sales.access') quickGroups(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.quickGroups(s, branchId);
  }
  @Get('category/:categoryId') @RequirePermissions('sales.access') category(
    @CurrentSession() s: Session,
    @Param('categoryId') categoryId: string,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.category(s, branchId, categoryId);
  }
}
@Controller('sales')
class SalesController {
  constructor(private svc: SalesService) {}
  @Post() @RequirePermissions('sales.create') create(@CurrentSession() s: Session, @Body() d: SaleDto) {
    return this.svc.create(s, d);
  }
  @Get() @RequirePermissions('sales.view') list(@CurrentSession() s: Session, @Query('q') q = '') {
    return this.svc.list(s, q);
  }
  @Get(':id') @RequirePermissions('sales.view') get(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.svc.get(s, id);
  }
  @Post(':id/cancel') @RequirePermissions('sales.cancel') cancel(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: CancelDto,
  ) {
    return this.svc.cancel(s, id, d.reason);
  }
  @Post(':id/returns') @RequirePermissions('sales.return') returns(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: ReturnDto,
  ) {
    return this.svc.return(s, id, d);
  }
  @Post(':id/reprint') @RequirePermissions('sales.reprintTicket') reprint(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    return this.svc.reprint(s, id);
  }
}
@Controller('payment-methods')
class PaymentMethodsController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('paymentMethods.view') list(@CurrentSession() s: Session) {
    return this.db.paymentMethod.findMany({ where: { companyId: s.companyId }, orderBy: { sortOrder: 'asc' } });
  }
  @Post() @RequirePermissions('paymentMethods.manage') create(@CurrentSession() s: Session, @Body() d: ConfigDto) {
    return this.db.paymentMethod.create({ data: { companyId: s.companyId, ...d } });
  }
  @Patch(':id') @RequirePermissions('paymentMethods.manage') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: ConfigDto,
  ) {
    return this.db.paymentMethod.updateMany({ where: { id, companyId: s.companyId }, data: d });
  }
}
@Controller('terminals')
class TerminalsController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('terminals.view') list(@CurrentSession() s: Session) {
    return this.db.terminal.findMany({
      where: { companyId: s.companyId, branchId: s.branchId ?? undefined },
      orderBy: { name: 'asc' },
    });
  }
  @Post() @RequirePermissions('terminals.manage') create(@CurrentSession() s: Session, @Body() d: TerminalDto) {
    return this.db.terminal.create({ data: { companyId: s.companyId, ...d } });
  }
  @Patch(':id') @RequirePermissions('terminals.manage') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: TerminalDto,
  ) {
    return this.db.terminal.updateMany({ where: { id, companyId: s.companyId }, data: d });
  }
}
@Module({
  imports: [StockModule],
  controllers: [PosController, SalesController, PaymentMethodsController, TerminalsController],
  providers: [SalesService, PriceResolutionService, PosCatalogService],
})
export class SalesModule {}
