import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentMethodKind, Prisma, SaleStatus, StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CurrentSession, RequirePermissions, Session, sessionCan } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
import { StockModule, StockService } from '../stock/stock.module';

class SaleLineDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @MaxLength(120) description?: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) manualPrice?: number;
  @IsOptional() @IsNumber() @Min(0) expectedUnitPrice?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
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
  @IsOptional() @IsUUID() cashSessionId?: string;
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
  @IsOptional() @IsEnum(PaymentMethodKind) kind?: PaymentMethodKind;
  @IsOptional() @IsInt() sortOrder?: number;
}
class TerminalDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() printerName?: string;
  @IsOptional() @IsObject() posConfig?: Record<string, unknown>;
}
class OpenCashSessionDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() terminalId?: string;
  @IsOptional() @IsString() terminalName?: string;
  @IsUUID() cashierUserId!: string;
  @IsNumber() @Min(0) openingAmount!: number;
}
class CloseCashSessionDto {
  @IsUUID() cashSessionId!: string;
  @IsNumber() @Min(0) closingAmount!: number;
  @IsOptional() @IsString() closingNote?: string;
}
class QuickGroupDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(1) icon!: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() buttonSize?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsArray() @IsUUID(undefined, { each: true }) productIds!: string[];
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
export class SalesService {
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
    const registeredIds = dto.items.flatMap((item) => item.productId ? [item.productId] : []);
    if (new Set(registeredIds).size !== registeredIds.length)
      throw new BadRequestException('Un producto no puede repetirse en varias líneas');
    try {
      return await this.db.$transaction(
      async (tx) => {
        const branch = await tx.branch.findFirst({ where: { id: dto.branchId, companyId: s.companyId, active: true } });
        const terminal = await tx.terminal.findFirst({
          where: { id: dto.terminalId, branchId: dto.branchId, companyId: s.companyId, active: true },
        });
        if (!branch || !terminal || (s.branchId && s.branchId !== dto.branchId))
          throw new BadRequestException('Sucursal o terminal inválida');
        const cashSession = dto.cashSessionId
          ? await tx.cashSession.findFirst({
              where: {
                id: dto.cashSessionId,
                companyId: s.companyId,
                branchId: dto.branchId,
                terminalId: dto.terminalId,
                status: 'OPEN',
              },
            })
          : null;
        if (branch.requireCashOpen && !cashSession) throw new BadRequestException('Debe abrir la caja antes de vender');
        const lines = [];
        for (const input of dto.items) {
          if (!input.productId) {
            if (!sessionCan(s, 'sales.manualPrice')) throw new BadRequestException('No tiene permiso para venta rápida');
            const name = input.description?.trim();
            if (!name) throw new BadRequestException('La venta rápida requiere una descripción');
            if (!(input.manualPrice && input.manualPrice > 0))
              throw new BadRequestException('La venta rápida requiere un precio mayor que cero');
            const price = new Prisma.Decimal(input.manualPrice);
            const pct = new Prisma.Decimal(input.discountPercent ?? 0);
            const amount = new Prisma.Decimal(input.discountAmount ?? 0);
            if ((pct.gt(0) || amount.gt(0)) && !sessionCan(s, 'sales.discountItem'))
              throw new BadRequestException('No tiene permiso para descuento por ítem');
            const subtotal = price.mul(input.quantity).mul(new Prisma.Decimal(1).minus(pct.div(100))).minus(amount);
            if (subtotal.lt(0)) throw new BadRequestException('Descuento inválido');
            lines.push({ input, config: null, price, originalPrice: price, pct, amount, subtotal, quickName: name });
            continue;
          }
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
          lines.push({ input, config, price, originalPrice: resolved, pct, amount, subtotal, quickName: undefined });
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
          if (method.kind === PaymentMethodKind.ACCOUNT && !sessionCan(s, 'sales.accountCredit'))
            throw new BadRequestException('No tiene permiso para cobrar a cuenta corriente');
          if (method.kind === PaymentMethodKind.ACCOUNT && !payment.reference?.trim())
            throw new BadRequestException('Cuenta corriente requiere identificar al cliente o cuenta');
          if (method.kind === PaymentMethodKind.CASH && (payment.receivedAmount ?? payment.amount) < payment.amount)
            throw new BadRequestException('Efectivo recibido insuficiente');
        }
        const numbered = await tx.terminal.update({
          where: { id: terminal.id },
          data: { nextSaleNumber: { increment: 1 } },
        });
        const saleNumber = `${branch.code}-${terminal.code}-${String(numbered.nextSaleNumber).padStart(8, '0')}`;
        const costTotal = lines.reduce(
          (sum, l) => sum.plus(l.config ? l.config.cost.mul(l.input.quantity) : 0),
          new Prisma.Decimal(0),
        );
        const sale = await tx.sale.create({
          data: {
            operationId: dto.operationId,
            companyId: s.companyId,
            branchId: dto.branchId,
            terminalId: dto.terminalId,
            cashSessionId: cashSession?.id,
            userId: cashSession?.cashierUserId ?? s.sub,
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
                branchProductId: l.config?.id,
                productNameSnapshot: l.config?.product.name ?? l.quickName ?? 'Venta rápida',
                barcodeSnapshot: l.config?.product.barcodes.find((b) => b.isPrimary)?.barcode,
                quantity: l.input.quantity,
                unitPrice: l.price,
                originalUnitPrice: l.originalPrice,
                costSnapshot: l.config?.cost ?? 0,
                discountPercent: l.pct,
                discountAmount: l.amount,
                subtotal: l.subtotal,
                taxRateSnapshot: l.config?.product.taxRate ?? 0,
                note: l.input.note?.trim() || undefined,
              })),
            },
            payments: {
              create: dto.payments.map((p) => {
                const method = methods.find((m) => m.id === p.paymentMethodId)!;
                const received = new Prisma.Decimal(p.receivedAmount ?? p.amount);
                return {
                  paymentMethodId: p.paymentMethodId,
                  amount: p.amount,
                  cashImpact: method.kind === PaymentMethodKind.CASH ? p.amount : 0,
                  receivedAmount: method.kind === PaymentMethodKind.CASH ? received : undefined,
                  changeAmount: method.kind === PaymentMethodKind.CASH ? received.minus(p.amount) : undefined,
                  reference: p.reference,
                };
              }),
            },
          },
          include: { items: true, payments: { include: { paymentMethod: true } } },
        });
        for (const l of lines)
          if (l.input.productId) await this.stock.change(
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
              action: lines.some((line) => !line.input.productId) ? 'SALE_QUICK_LINE' : 'SALE_MANUAL_PRICE',
            },
          });
        return this.visible(s, sale);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const completed = await this.db.sale.findUnique({
          where: { operationId: dto.operationId },
          include: { items: true, payments: { include: { paymentMethod: true } } },
        });
        if (completed?.companyId === s.companyId) return this.visible(s, completed);
      }
      throw error;
    }
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
          if (item.productId) await this.stock.change(
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
                returnToStock: Boolean(x.item.productId) && (x.input.returnToStock ?? true),
              })),
            },
          },
          include: { items: true },
        });
        for (const x of data)
          if (x.item.productId && (x.input.returnToStock ?? true))
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
              { supplierProducts: { some: { active: true, OR: [
                { supplierCode: { contains: q, mode: 'insensitive' } },
                { supplierBarcode: { contains: q, mode: 'insensitive' } },
                { supplierDescription: { contains: q, mode: 'insensitive' } },
              ] } } },
              { supplierAliases: { some: { normalizedDescription: { contains: q.toLowerCase() } } } },
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
    const configured = await this.db.posQuickGroup.findMany({
      where: { companyId: s.companyId, branchId, active: true },
      select: { id: true, name: true, icon: true, buttonSize: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (configured.length) return configured.map((group) => ({ ...group, kind: 'GROUP' }));
    return this.db.category.findMany({
      where: {
        companyId: s.companyId,
        active: true,
        deletedAt: null,
        products: { some: { active: true, deletedAt: null, branchConfigs: { some: { branchId, enabled: true } } } },
      },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 50,
    }).then((groups) => {
      const priority = ['fruta', 'verdura', 'panader', 'fiambre', 'leña', 'carbon', 'carbón'];
      return groups
        .sort((a, b) => {
          const rank = (name: string) => {
            const normalized = name.toLocaleLowerCase('es-AR');
            const index = priority.findIndex((term) => normalized.includes(term));
            return index < 0 ? priority.length : index;
          };
          return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'es-AR');
        })
        .slice(0, 16)
        .map((group) => ({ ...group, icon: '', buttonSize: 'MEDIUM', kind: 'CATEGORY' }));
    });
  }

  category(s: Session, branchId: string, categoryId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(categoryId)) throw new BadRequestException('Categoría inválida');
    return this.resolve(s, branchId, { categoryId });
  }
  async settings(s: Session, branchId: string) {
    await this.branch(s, branchId);
    const [company, branch] = await Promise.all([
      this.db.companySetting.findMany({ where: { companyId: s.companyId, key: { in: ['appearance', 'pos'] } } }),
      this.db.branchSetting.findMany({ where: { companyId: s.companyId, branchId, key: { in: ['appearance', 'pos'] } } }),
    ]);
    return Object.fromEntries([...company, ...branch].map((setting) => [setting.key, setting.value]));
  }

  async quickGroup(s: Session, branchId: string, groupId: string) {
    await this.branch(s, branchId);
    const group = await this.db.posQuickGroup.findFirst({
      where: { id: groupId, companyId: s.companyId, branchId, active: true },
      include: { items: { orderBy: { sortOrder: 'asc' }, select: { productId: true } } },
    });
    if (!group) throw new NotFoundException('Grupo rápido no encontrado');
    const order = group.items.map((item) => item.productId);
    return this.resolve(s, branchId, { id: { in: order } }).then((products) =>
      products.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
    );
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
  @Get('settings') @RequirePermissions('sales.access') settings(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.settings(s, branchId);
  }
  @Get('category/:categoryId') @RequirePermissions('sales.access') category(
    @CurrentSession() s: Session,
    @Param('categoryId') categoryId: string,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.category(s, branchId, categoryId);
  }
  @Get('quick-group/:groupId') @RequirePermissions('sales.access') quickGroup(
    @CurrentSession() s: Session,
    @Param('groupId') groupId: string,
    @Query('branchId') branchId: string,
  ) {
    return this.catalog.quickGroup(s, branchId, groupId);
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
export class PaymentMethodsController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('sales.access') async list(@CurrentSession() s: Session) {
    await this.db.paymentMethod.createMany({ data: [
        ['CASH', 'Efectivo', PaymentMethodKind.CASH],
        ['DEBIT', 'Débito', PaymentMethodKind.DEBIT],
        ['CREDIT', 'Crédito', PaymentMethodKind.CREDIT],
        ['TRANSFER', 'Transferencia', PaymentMethodKind.TRANSFER],
        ['MERCADO_PAGO', 'QR / Mercado Pago', PaymentMethodKind.QR],
        ['ACCOUNT_CURRENT', 'Cuenta corriente', PaymentMethodKind.ACCOUNT],
        ['OTHER', 'Otro', PaymentMethodKind.OTHER],
    ].map(([code, name, kind], sortOrder) => ({ companyId: s.companyId, code, name, kind: kind as PaymentMethodKind, sortOrder, requiresReference: ['TRANSFER', 'MERCADO_PAGO', 'ACCOUNT_CURRENT', 'OTHER'].includes(code as string) })), skipDuplicates: true });
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
      include: { cashSessions: { where: { status: 'OPEN' }, take: 1, select: { id: true, openedAt: true, cashier: { select: { firstName: true, lastName: true } } } } },
      orderBy: { name: 'asc' },
    });
  }
  @Post() @RequirePermissions('terminals.manage') create(@CurrentSession() s: Session, @Body() d: TerminalDto) {
    return this.ownedBranch(s, d.branchId).then(() => this.db.terminal.create({ data: { companyId: s.companyId, ...d, posConfig: d.posConfig as Prisma.InputJsonValue | undefined, code: d.code.trim().toUpperCase() } }));
  }
  @Patch(':id') @RequirePermissions('terminals.manage') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: TerminalDto,
  ) {
    return this.ownedBranch(s, d.branchId).then(() => this.db.terminal.updateMany({ where: { id, companyId: s.companyId }, data: { ...d, posConfig: d.posConfig as Prisma.InputJsonValue | undefined, code: d.code.trim().toUpperCase() } }));
  }
  private async ownedBranch(s: Session, branchId: string) {
    if (s.branchId && s.branchId !== branchId) throw new BadRequestException('Sucursal inválida');
    if (!(await this.db.branch.count({ where: { id: branchId, companyId: s.companyId, active: true, deletedAt: null } }))) throw new BadRequestException('Sucursal inválida');
  }
}

@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private db: PrismaService) {}
  private userBranchWhere(s: Session, userId: string, branchId?: string) {
    return {
      companyId: s.companyId,
      active: true,
      deletedAt: null,
      ...(branchId ? { id: branchId } : {}),
      ...(s.roles.includes('SUPER_ADMIN') && userId === s.sub
        ? {}
        : { OR: [{ users: { some: { id: userId } } }, { userAccesses: { some: { userId } } }] }),
    };
  }
  private async branch(s: Session, branchId: string) {
    if (s.branchId && s.branchId !== branchId) throw new BadRequestException('Sucursal inválida');
    const branch = await this.db.branch.findFirst({
      where: this.userBranchWhere(s, s.sub, branchId),
      select: { id: true, name: true },
    });
    if (!branch) throw new BadRequestException('Sucursal inválida');
    return branch;
  }
  @Get('branches') @RequirePermissions('sales.access') branches(@CurrentSession() s: Session) {
    return this.db.branch.findMany({
      where: { ...this.userBranchWhere(s, s.sub), ...(s.branchId ? { id: s.branchId } : {}) },
      orderBy: { name: 'asc' },
    });
  }
  @Get('bootstrap') @RequirePermissions('sales.access') async bootstrap(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string,
  ) {
    const branch = await this.branch(s, branchId);
    const [terminals, cashiers] = await Promise.all([
      this.db.terminal.findMany({ where: { companyId: s.companyId, branchId, active: true }, orderBy: { name: 'asc' } }),
      this.db.user.findMany({
        where: {
          companyId: s.companyId,
          active: true,
          deletedAt: null,
          ...(!s.roles.includes('SUPER_ADMIN') && !s.permissions.includes('sales.authorizeDiscount') ? { id: s.sub } : {}),
          OR: [{ branchId }, { branchAccesses: { some: { branchId } } }],
        },
        select: { id: true, firstName: true, lastName: true, username: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);
    return { branch, terminals, cashiers };
  }
  @Get('current') @RequirePermissions('sales.access') async current(
    @CurrentSession() s: Session,
    @Query('terminalId') terminalId: string,
  ) {
    const current = await this.db.cashSession.findFirst({
      where: { companyId: s.companyId, terminalId, status: 'OPEN' },
      include: { cashier: { select: { id: true, firstName: true, lastName: true, username: true } }, terminal: true },
      orderBy: { openedAt: 'desc' },
    });
    if (current) await this.branch(s, current.branchId);
    return current;
  }
  @Post('open') @RequirePermissions('cashSessions.open') async open(
    @CurrentSession() s: Session,
    @Body() dto: OpenCashSessionDto,
  ) {
    await this.branch(s, dto.branchId);
    if (dto.cashierUserId !== s.sub && !s.roles.includes('SUPER_ADMIN') && !s.permissions.includes('sales.authorizeDiscount'))
      throw new BadRequestException('No puede abrir caja para otro cajero');
    let terminal = dto.terminalId
      ? await this.db.terminal.findFirst({ where: { id: dto.terminalId, companyId: s.companyId, branchId: dto.branchId, active: true } })
      : null;
    if (!terminal) {
      if (dto.terminalId) throw new BadRequestException('Terminal inválida');
      if (!sessionCan(s, 'terminals.manage')) throw new BadRequestException('No hay terminal configurada. Solicite a un administrador que cree una.');
      const count = await this.db.terminal.count({ where: { companyId: s.companyId, branchId: dto.branchId } });
      terminal = await this.db.terminal.create({ data: { companyId: s.companyId, branchId: dto.branchId, code: `CAJA-${count + 1}`, name: dto.terminalName?.trim() || `Caja ${count + 1}` } });
    }
    const cashier = await this.db.user.findFirst({
      where: { id: dto.cashierUserId, companyId: s.companyId, active: true, deletedAt: null, OR: [{ branchId: dto.branchId }, { branchAccesses: { some: { branchId: dto.branchId } } }] },
    });
    if (!terminal || !cashier)
      throw new BadRequestException('Terminal o cajero inválido');
    const existing = await this.db.cashSession.findFirst({ where: { terminalId: terminal.id, status: 'OPEN' } });
    if (existing) throw new BadRequestException('La terminal ya tiene una caja abierta');
    return this.db.$transaction(async (tx) => {
      const opened = await tx.cashSession.create({
        data: { companyId: s.companyId, branchId: dto.branchId, terminalId: terminal.id, cashierUserId: dto.cashierUserId, openedByUserId: s.sub, openingAmount: dto.openingAmount },
        include: { cashier: { select: { id: true, firstName: true, lastName: true, username: true } }, terminal: true },
      });
      await tx.auditLog.create({ data: { companyId: s.companyId, branchId: dto.branchId, userId: s.sub, entityType: 'CASH_SESSION', entityId: opened.id, action: 'CASH_SESSION_OPENED', metadata: { openingAmount: String(dto.openingAmount), terminalId: terminal.id, cashierUserId: dto.cashierUserId } } });
      return opened;
    });
  }
  @Post('close') @RequirePermissions('cashSessions.close') async close(
    @CurrentSession() s: Session,
    @Body() dto: CloseCashSessionDto,
  ) {
    const current = await this.db.cashSession.findFirst({
      where: { id: dto.cashSessionId, companyId: s.companyId, status: 'OPEN' },
      include: { terminal: true, cashier: { select: { id: true, firstName: true, lastName: true, username: true } } },
    });
    if (!current) throw new NotFoundException('La caja ya está cerrada o no existe');
    await this.branch(s, current.branchId);
    if (current.cashierUserId !== s.sub && !s.roles.includes('SUPER_ADMIN') && !s.permissions.includes('sales.authorizeDiscount'))
      throw new BadRequestException('No puede cerrar la caja de otro cajero');
    return this.db.$transaction(async (tx) => {
      const cashPayments = await tx.payment.aggregate({
        where: { sale: { cashSessionId: current.id, status: SaleStatus.COMPLETED } },
        _sum: { cashImpact: true },
      });
      const expectedCash = new Prisma.Decimal(current.openingAmount).plus(cashPayments._sum.cashImpact ?? 0);
      const closed = await tx.cashSession.update({
        where: { id: current.id },
        data: { status: 'CLOSED', closingAmount: dto.closingAmount, closingNote: dto.closingNote?.trim() || null, closedAt: new Date(), closedByUserId: s.sub },
        include: { terminal: true, cashier: { select: { id: true, firstName: true, lastName: true, username: true } } },
      });
      await tx.auditLog.create({ data: { companyId: s.companyId, branchId: current.branchId, userId: s.sub, entityType: 'CASH_SESSION', entityId: current.id, action: 'CASH_SESSION_CLOSED', metadata: { openingAmount: String(current.openingAmount), cashSales: String(cashPayments._sum.cashImpact ?? 0), expectedCash: expectedCash.toString(), closingAmount: String(dto.closingAmount), difference: new Prisma.Decimal(dto.closingAmount).minus(expectedCash).toString(), terminalId: current.terminalId, cashierUserId: current.cashierUserId } } });
      return { ...closed, cashSales: cashPayments._sum.cashImpact ?? 0, expectedCash, difference: new Prisma.Decimal(dto.closingAmount).minus(expectedCash) };
    });
  }
}

@Controller('pos-quick-groups')
class PosQuickGroupsController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('branches.settings') list(@CurrentSession() s: Session, @Query('branchId') branchId: string) {
    return this.db.posQuickGroup.findMany({ where: { companyId: s.companyId, branchId }, include: { items: { orderBy: { sortOrder: 'asc' }, include: { product: { select: { id: true, name: true, internalCode: true } } } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }
  private async save(s: Session, dto: QuickGroupDto, id?: string) {
    if (s.branchId && s.branchId !== dto.branchId) throw new BadRequestException('Sucursal inválida');
    const [branch, productCount] = await Promise.all([
      this.db.branch.count({ where: { id: dto.branchId, companyId: s.companyId, active: true, deletedAt: null } }),
      this.db.product.count({ where: { id: { in: dto.productIds }, companyId: s.companyId, active: true, deletedAt: null, branchConfigs: { some: { branchId: dto.branchId, enabled: true } } } }),
    ]);
    if (!branch || productCount !== new Set(dto.productIds).size) throw new BadRequestException('Sucursal o productos inválidos');
    return this.db.$transaction(async (tx) => {
      const group = id
        ? await tx.posQuickGroup.update({ where: { id }, data: { name: dto.name, icon: dto.icon, sortOrder: dto.sortOrder ?? 0, buttonSize: dto.buttonSize ?? 'MEDIUM', active: dto.active ?? true } })
        : await tx.posQuickGroup.create({ data: { companyId: s.companyId, branchId: dto.branchId, name: dto.name, icon: dto.icon, sortOrder: dto.sortOrder ?? 0, buttonSize: dto.buttonSize ?? 'MEDIUM', active: dto.active ?? true } });
      if (id) await tx.posQuickGroupItem.deleteMany({ where: { groupId: id } });
      if (dto.productIds.length) await tx.posQuickGroupItem.createMany({ data: dto.productIds.map((productId, sortOrder) => ({ groupId: group.id, productId, sortOrder })) });
      return group;
    });
  }
  @Post() @RequirePermissions('branches.settings') create(@CurrentSession() s: Session, @Body() dto: QuickGroupDto) { return this.save(s, dto); }
  @Patch(':id') @RequirePermissions('branches.settings') async update(@CurrentSession() s: Session, @Param('id') id: string, @Body() dto: QuickGroupDto) {
    const owned = await this.db.posQuickGroup.findFirst({ where: { id, companyId: s.companyId, branchId: dto.branchId } });
    if (!owned) throw new NotFoundException('Grupo no encontrado');
    return this.save(s, dto, id);
  }
  @Delete(':id') @RequirePermissions('branches.settings') async remove(@CurrentSession() s: Session, @Param('id') id: string) {
    const result = await this.db.posQuickGroup.deleteMany({ where: { id, companyId: s.companyId } });
    if (!result.count) throw new NotFoundException('Grupo no encontrado');
    return result;
  }
}
@Module({
  imports: [StockModule],
  controllers: [PosController, SalesController, PaymentMethodsController, TerminalsController, CashSessionsController, PosQuickGroupsController],
  providers: [SalesService, PriceResolutionService, PosCatalogService],
})
export class SalesModule {}
