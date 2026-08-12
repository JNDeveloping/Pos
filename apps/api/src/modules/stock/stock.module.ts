import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  InventoryStatus,
  InventoryType,
  Prisma,
  StockMovementType,
  StockTransferStatus,
  WasteType,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
import { nextStock, stockStatus } from './stock-policy';

class AdjustmentDto {
  @IsUUID() branchId!: string;
  @IsUUID() productId!: string;
  @IsEnum(['INCREASE', 'DECREASE', 'SET', 'INITIAL']) mode!: 'INCREASE' | 'DECREASE' | 'SET' | 'INITIAL';
  @IsNumber() @Min(0) quantity!: number;
  @IsString() @MinLength(3) reason!: string;
}
class InventoryDto {
  @IsUUID() branchId!: string;
  @IsString() @MinLength(2) name!: string;
  @IsEnum(InventoryType) type!: InventoryType;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() productIds?: string[];
  @IsOptional() @IsString() notes?: string;
}
class CountDto {
  @IsNumber() @Min(0) quantity!: number;
  @IsOptional() @IsString() notes?: string;
}
class WasteDto {
  @IsUUID() branchId!: string;
  @IsUUID() productId!: string;
  @IsEnum(WasteType) type!: WasteType;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsString() @MinLength(3) reason!: string;
  @IsOptional() @IsString() notes?: string;
}
class TransferItemDto {
  @IsUUID() productId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
}
class TransferDto {
  @IsUUID() fromBranchId!: string;
  @IsUUID() toBranchId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => TransferItemDto) items!: TransferItemDto[];
  @IsOptional() @IsString() notes?: string;
}
class ReceiveItemDto {
  @IsUUID() itemId!: string;
  @IsNumber() @Min(0) quantity!: number;
}
class ReceiveDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveItemDto) items!: ReceiveItemDto[];
}

@Injectable()
export class StockService {
  constructor(private db: PrismaService) {}

  async change(
    tx: Prisma.TransactionClient,
    s: Session,
    branchId: string,
    productId: string,
    delta: number,
    type: StockMovementType,
    reason?: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${branchId + ':' + productId}))`;
    if (referenceType && referenceId) {
      const existing = await tx.stockMovement.findFirst({
        where: { companyId: s.companyId, productId, type, referenceType, referenceId },
      });
      if (existing) return existing;
    }
    const branch = await tx.branch.findFirst({ where: { id: branchId, companyId: s.companyId, active: true } });
    if (!branch) throw new BadRequestException('Sucursal inválida');
    const current = await tx.stock.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { companyId: s.companyId, branchId, productId },
      update: {},
    });
    let value: number;
    try {
      value = nextStock(Number(current.quantity), delta, branch.allowNegativeStock);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    await tx.stock.update({ where: { id: current.id }, data: { quantity: value } });
    return tx.stockMovement.create({
      data: {
        companyId: s.companyId,
        branchId,
        productId,
        type,
        quantity: delta,
        previousQuantity: current.quantity,
        newQuantity: value,
        reason,
        referenceType,
        referenceId,
        userId: s.sub,
      },
    });
  }

  adjust(s: Session, dto: AdjustmentDto) {
    return this.db.$transaction(
      async (tx) => {
        const current = await tx.stock.findUnique({
          where: { branchId_productId: { branchId: dto.branchId, productId: dto.productId } },
        });
        const delta =
          dto.mode === 'SET' || dto.mode === 'INITIAL'
            ? dto.quantity - Number(current?.quantity ?? 0)
            : dto.mode === 'DECREASE'
              ? -dto.quantity
              : dto.quantity;
        const type =
          dto.mode === 'INITIAL'
            ? StockMovementType.INITIAL_STOCK
            : delta < 0
              ? StockMovementType.MANUAL_DECREASE
              : StockMovementType.MANUAL_INCREASE;
        const movement = await this.change(tx, s, dto.branchId, dto.productId, delta, type, dto.reason);
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            branchId: dto.branchId,
            userId: s.sub,
            action: dto.mode === 'INITIAL' ? 'INITIAL_STOCK_LOADED' : 'STOCK_ADJUSTED',
            entityType: 'STOCK',
            entityId: dto.productId,
            metadata: { mode: dto.mode, quantity: dto.quantity, reason: dto.reason },
          },
        });
        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async receivePurchaseInTransaction(
    tx: Prisma.TransactionClient,
    s: Session,
    purchase: { id: string; branchId: string; items: { productId: string; totalUnits: Prisma.Decimal }[] },
  ) {
    const results = [];
    const totals = new Map<string, Prisma.Decimal>();
    for (const item of purchase.items)
      totals.set(item.productId, (totals.get(item.productId) ?? new Prisma.Decimal(0)).plus(item.totalUnits));
    for (const [productId, totalUnits] of totals)
      results.push(
        await this.change(
          tx,
          s,
          purchase.branchId,
          productId,
          Number(totalUnits),
          StockMovementType.PURCHASE_RECEIPT,
          'Compra confirmada',
          'PURCHASE',
          purchase.id,
        ),
      );
    return results;
  }
}

@Controller('stock')
class StockController {
  constructor(
    private db: PrismaService,
    private stock: StockService,
  ) {}
  @Get()
  @RequirePermissions('stock.view')
  async list(@CurrentSession() s: Session, @Query('branchId') branchId?: string, @Query('search') search = '') {
    const rows = await this.db.stock.findMany({
      where: { companyId: s.companyId, branchId: branchId || s.branchId || undefined },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    const products = await this.db.product.findMany({
      where: {
        companyId: s.companyId,
        id: { in: rows.map((x) => x.productId) },
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { internalCode: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { category: true, brand: true, branchConfigs: true },
    });
    const map = new Map(products.map((p) => [p.id, p]));
    return rows
      .filter((r) => map.has(r.productId))
      .map((r) => {
        const p = map.get(r.productId)!;
        const available = Number(r.quantity) - Number(r.reservedQuantity);
        const config = p.branchConfigs.find((x) => x.branchId === r.branchId);
        const minimum = Number(config?.stockMinimum ?? 0);
        return {
          ...r,
          product: p,
          availableQuantity: available,
          minimumStock: minimum,
          status: stockStatus(available, minimum),
          stockValue: Number(r.quantity) * Number(config?.cost ?? 0),
        };
      });
  }
  @Get('movements')
  @RequirePermissions('stock.movements')
  async movements(
    @CurrentSession() s: Session,
    @Query('page') rawPage = '1',
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
  ) {
    const page = Math.max(1, Number(rawPage) || 1),
      where = { companyId: s.companyId, branchId: branchId || s.branchId || undefined, productId };
    const [data, total] = await Promise.all([
      this.db.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
      this.db.stockMovement.count({ where }),
    ]);
    return { data, meta: { page, total, pages: Math.ceil(total / 50) } };
  }
  @Post('adjust') @RequirePermissions('stock.adjust') adjust(@CurrentSession() s: Session, @Body() dto: AdjustmentDto) {
    return this.stock.adjust(s, dto);
  }
  @Get('expirations')
  @RequirePermissions('expirations.view')
  expirations(@CurrentSession() s: Session, @Query('days') days = '60') {
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + Math.min(365, Number(days) || 60));
    return this.db.stockLot.findMany({
      where: { companyId: s.companyId, expirationDate: { lte: until }, quantity: { gt: 0 } },
      orderBy: { expirationDate: 'asc' },
      take: 500,
    });
  }
}

@Controller('inventories')
class InventoryController {
  constructor(
    private db: PrismaService,
    private stock: StockService,
  ) {}
  @Get() @RequirePermissions('inventory.view') list(@CurrentSession() s: Session) {
    return this.db.inventory.findMany({
      where: { companyId: s.companyId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post()
  @RequirePermissions('inventory.create')
  create(@CurrentSession() s: Session, @Body() dto: InventoryDto) {
    return this.db.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          companyId: s.companyId,
          active: true,
          categoryId: dto.categoryId,
          id: dto.productIds?.length ? { in: dto.productIds } : undefined,
        },
        select: { id: true },
      });
      const stocks = await tx.stock.findMany({
        where: { branchId: dto.branchId, productId: { in: products.map((p) => p.id) } },
      });
      const quantities = new Map(stocks.map((x) => [x.productId, x.quantity]));
      return tx.inventory.create({
        data: {
          companyId: s.companyId,
          branchId: dto.branchId,
          name: dto.name,
          type: dto.type,
          categoryId: dto.categoryId,
          notes: dto.notes,
          status: InventoryStatus.IN_PROGRESS,
          startedAt: new Date(),
          createdByUserId: s.sub,
          items: { create: products.map((p) => ({ productId: p.id, systemQuantity: quantities.get(p.id) ?? 0 })) },
        },
        include: { items: true },
      });
    });
  }
  @Get(':id') @RequirePermissions('inventory.view') get(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.db.inventory.findFirst({ where: { id, companyId: s.companyId }, include: { items: true } });
  }
  @Patch(':id/items/:itemId')
  @RequirePermissions('inventory.count')
  async count(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountDto,
  ) {
    const inventory = await this.db.inventory.findFirst({
      where: { id, companyId: s.companyId, status: { in: [InventoryStatus.IN_PROGRESS, InventoryStatus.REVIEW] } },
    });
    if (!inventory) throw new BadRequestException('Inventario no editable');
    const item = await this.db.inventoryItem.findFirst({ where: { id: itemId, inventoryId: id } });
    if (!item) throw new BadRequestException('Ítem inválido');
    return this.db.inventoryItem.update({
      where: { id: itemId },
      data: {
        countedQuantity: dto.quantity,
        difference: dto.quantity - Number(item.systemQuantity),
        notes: dto.notes,
        countedByUserId: s.sub,
        countedAt: new Date(),
      },
    });
  }
  @Post(':id/confirm')
  @RequirePermissions('inventory.confirm')
  confirm(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.db.$transaction(
      async (tx) => {
        const inv = await tx.inventory.findFirst({ where: { id, companyId: s.companyId }, include: { items: true } });
        if (!inv || inv.status === InventoryStatus.CONFIRMED)
          throw new BadRequestException('Inventario no confirmable');
        for (const item of inv.items)
          if (item.difference && Number(item.difference) !== 0)
            await this.stock.change(
              tx,
              s,
              inv.branchId,
              item.productId,
              Number(item.difference),
              StockMovementType.INVENTORY_ADJUSTMENT,
              `Inventario ${inv.name}`,
              'INVENTORY',
              inv.id,
            );
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            branchId: inv.branchId,
            userId: s.sub,
            action: 'INVENTORY_CONFIRMED',
            entityType: 'INVENTORY',
            entityId: inv.id,
          },
        });
        return tx.inventory.update({
          where: { id },
          data: { status: InventoryStatus.CONFIRMED, completedAt: new Date(), confirmedByUserId: s.sub },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

@Controller('waste')
class WasteController {
  constructor(
    private db: PrismaService,
    private stock: StockService,
  ) {}
  @Get() @RequirePermissions('waste.view') list(@CurrentSession() s: Session) {
    return this.db.waste.findMany({ where: { companyId: s.companyId }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
  @Post() @RequirePermissions('waste.create') create(@CurrentSession() s: Session, @Body() dto: WasteDto) {
    return this.db.$transaction(
      async (tx) => {
        const config = await tx.branchProduct.findUnique({
          where: { branchId_productId: { branchId: dto.branchId, productId: dto.productId } },
        });
        const cost = Number(config?.cost ?? 0);
        const row = await tx.waste.create({
          data: {
            ...dto,
            companyId: s.companyId,
            userId: s.sub,
            unitCostSnapshot: cost,
            totalCost: cost * dto.quantity,
          },
        });
        const movement =
          dto.type === WasteType.BREAKAGE
            ? StockMovementType.BREAKAGE
            : dto.type === WasteType.EXPIRATION
              ? StockMovementType.EXPIRATION
              : dto.type === WasteType.INTERNAL_CONSUMPTION
                ? StockMovementType.INTERNAL_CONSUMPTION
                : StockMovementType.WASTE;
        await this.stock.change(
          tx,
          s,
          dto.branchId,
          dto.productId,
          -dto.quantity,
          movement,
          dto.reason,
          'WASTE',
          row.id,
        );
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            branchId: dto.branchId,
            userId: s.sub,
            action: dto.type === WasteType.EXPIRATION ? 'EXPIRATION_REGISTERED' : 'WASTE_REGISTERED',
            entityType: 'WASTE',
            entityId: row.id,
          },
        });
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

@Controller('transfers')
class TransferController {
  constructor(
    private db: PrismaService,
    private stock: StockService,
  ) {}
  @Get() @RequirePermissions('transfers.view') list(@CurrentSession() s: Session) {
    return this.db.stockTransfer.findMany({
      where: { companyId: s.companyId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post() @RequirePermissions('transfers.create') async create(@CurrentSession() s: Session, @Body() dto: TransferDto) {
    if (dto.fromBranchId === dto.toBranchId) throw new BadRequestException('Origen y destino deben ser diferentes');
    const branches = await this.db.branch.count({
      where: { companyId: s.companyId, active: true, id: { in: [dto.fromBranchId, dto.toBranchId] } },
    });
    if (branches !== 2) throw new BadRequestException('Necesitás al menos dos sucursales activas');
    const count = await this.db.stockTransfer.count({ where: { companyId: s.companyId } });
    return this.db.stockTransfer.create({
      data: {
        companyId: s.companyId,
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        number: `TR-${String(count + 1).padStart(5, '0')}`,
        createdByUserId: s.sub,
        notes: dto.notes,
        items: { create: dto.items.map((x) => ({ productId: x.productId, requestedQuantity: x.quantity })) },
      },
      include: { items: true },
    });
  }
  @Post(':id/send') @RequirePermissions('transfers.send') send(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.db.$transaction(
      async (tx) => {
        const transfer = await tx.stockTransfer.findFirst({
          where: {
            id,
            companyId: s.companyId,
            status: { in: [StockTransferStatus.DRAFT, StockTransferStatus.REQUESTED, StockTransferStatus.PREPARING] },
          },
          include: { items: true },
        });
        if (!transfer) throw new BadRequestException('Transferencia no enviable');
        for (const item of transfer.items) {
          const quantity = Number(item.requestedQuantity);
          await this.stock.change(
            tx,
            s,
            transfer.fromBranchId,
            item.productId,
            -quantity,
            StockMovementType.TRANSFER_OUT,
            `Transferencia ${transfer.number}`,
            'TRANSFER',
            transfer.id,
          );
          const dest = await tx.stock.upsert({
            where: { branchId_productId: { branchId: transfer.toBranchId, productId: item.productId } },
            create: { companyId: s.companyId, branchId: transfer.toBranchId, productId: item.productId },
            update: {},
          });
          await tx.stock.update({ where: { id: dest.id }, data: { inTransitQuantity: { increment: quantity } } });
          await tx.stockTransferItem.update({ where: { id: item.id }, data: { sentQuantity: quantity } });
        }
        return tx.stockTransfer.update({
          where: { id },
          data: { status: StockTransferStatus.IN_TRANSIT, sentAt: new Date(), sentByUserId: s.sub },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  @Post(':id/receive') @RequirePermissions('transfers.receive') receive(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() dto: ReceiveDto,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const transfer = await tx.stockTransfer.findFirst({
          where: {
            id,
            companyId: s.companyId,
            status: { in: [StockTransferStatus.IN_TRANSIT, StockTransferStatus.PARTIALLY_RECEIVED] },
          },
          include: { items: true },
        });
        if (!transfer) throw new BadRequestException('Transferencia no recepcionable');
        let complete = true;
        for (const input of dto.items) {
          const item = transfer.items.find((x) => x.id === input.itemId);
          if (!item) throw new BadRequestException('Ítem inválido');
          const delta = input.quantity - Number(item.receivedQuantity);
          if (delta < 0 || input.quantity > Number(item.sentQuantity))
            throw new BadRequestException('Cantidad recibida inválida');
          if (delta) {
            await this.stock.change(
              tx,
              s,
              transfer.toBranchId,
              item.productId,
              delta,
              StockMovementType.TRANSFER_IN,
              `Transferencia ${transfer.number}`,
            );
            await tx.stock.update({
              where: { branchId_productId: { branchId: transfer.toBranchId, productId: item.productId } },
              data: { inTransitQuantity: { decrement: delta } },
            });
            await tx.stockTransferItem.update({ where: { id: item.id }, data: { receivedQuantity: input.quantity } });
          }
          if (input.quantity < Number(item.sentQuantity)) complete = false;
        }
        return tx.stockTransfer.update({
          where: { id },
          data: {
            status: complete ? StockTransferStatus.RECEIVED : StockTransferStatus.PARTIALLY_RECEIVED,
            receivedAt: complete ? new Date() : null,
            receivedByUserId: s.sub,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

@Module({
  controllers: [StockController, InventoryController, WasteController, TransferController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
