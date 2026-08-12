import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChangeSource, InvoiceItemStatus, Prisma, PurchaseOrderStatus, PurchaseStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { StockModule, StockService } from '../stock/stock.module';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
import { InvoiceAnalysisResult, InvoiceAnalysisService, ManualInvoiceAnalyzer } from './invoice-analysis.service';
class OrderItemDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() supplierProductId?: string;
  @IsNumberString() quantity!: string;
  @IsOptional() unitsPerCase?: number;
  @IsNumberString() unitCost!: string;
  @IsOptional() @IsNumberString() discountPercent?: string;
  @IsOptional() @IsNumberString() discountAmount?: string;
}
class OrderDto {
  @IsUUID() branchId!: string;
  @IsUUID() supplierId!: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
}
class PurchaseItemDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() supplierProductId?: string;
  @IsString() descriptionSnapshot!: string;
  @IsOptional() @IsString() supplierCodeSnapshot?: string;
  @IsNumberString() packagesQuantity!: string;
  @IsOptional() unitsPerCase?: number;
  @IsNumberString() totalUnits!: string;
  @IsNumberString() unitCost!: string;
  @IsOptional() @IsNumberString() discountPercent?: string;
  @IsOptional() @IsNumberString() discountAmount?: string;
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @IsBoolean() extraItem?: boolean;
}
class PurchaseDto {
  @IsUUID() branchId!: string;
  @IsUUID() supplierId!: string;
  @IsOptional() @IsUUID() purchaseOrderId?: string;
  @IsOptional() @IsString() invoiceType?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsDateString() invoiceDate!: string;
  @IsOptional() @IsDateString() receivedDate?: string;
  @IsOptional() @IsNumberString() taxTotal?: string;
  @IsOptional() @IsNumberString() otherCharges?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PurchaseItemDto) items!: PurchaseItemDto[];
}
class ConfirmDto {
  @IsOptional() @IsBoolean() applyCosts?: boolean;
  @IsOptional() @IsBoolean() keepMargin?: boolean;
}
class StatusDto {
  @IsEnum(PurchaseOrderStatus) status!: PurchaseOrderStatus;
}
class CorrectionDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsBoolean() learnAlias?: boolean;
}
type UploadedInvoice = { buffer: Buffer; mimetype: string; size: number; originalname: string };
@Injectable()
class PurchasesService {
  constructor(
    private db: PrismaService,
    private stock: StockService,
  ) {}
  async context(s: Session, branchId: string, supplierId: string) {
    const [b, p] = await Promise.all([
      this.db.branch.findFirst({ where: { id: branchId, companyId: s.companyId, deletedAt: null } }),
      this.db.supplier.findFirst({ where: { id: supplierId, companyId: s.companyId, deletedAt: null } }),
    ]);
    if (!b || !p || (s.branchId && s.branchId !== branchId))
      throw new NotFoundException('Sucursal o proveedor no encontrado');
  }
  list(
    s: Session,
    q: { supplierId?: string; branchId?: string; status?: PurchaseStatus; search?: string; page?: string },
  ) {
    const page = Number(q.page || 1),
      where: Prisma.PurchaseWhereInput = {
        companyId: s.companyId,
        supplierId: q.supplierId,
        branchId: s.branchId ?? q.branchId,
        status: q.status,
        OR: q.search
          ? [
              { invoiceNumber: { contains: q.search, mode: 'insensitive' } },
              { supplier: { name: { contains: q.search, mode: 'insensitive' } } },
            ]
          : undefined,
      };
    return this.db.$transaction(async (tx) => {
      const [data, total] = await Promise.all([
        tx.purchase.findMany({
          where,
          include: { supplier: true, branch: true, _count: { select: { items: true, documents: true } } },
          orderBy: { invoiceDate: 'desc' },
          skip: (page - 1) * 30,
          take: 30,
        }),
        tx.purchase.count({ where }),
      ]);
      return { data, meta: { page, total, pages: Math.ceil(total / 30) } };
    });
  }
  async get(s: Session, id: string) {
    const x = await this.db.purchase.findFirst({
      where: { id, companyId: s.companyId },
      include: {
        supplier: true,
        branch: true,
        items: { include: { product: true } },
        documents: true,
        purchaseOrder: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!x) throw new NotFoundException('Compra no encontrada');
    return x;
  }
  async order(s: Session, d: OrderDto) {
    await this.context(s, d.branchId, d.supplierId);
    if (!d.items.length) throw new BadRequestException('La orden requiere productos');
    return this.db.$transaction(async (tx) => {
      const n = await tx.purchaseOrder.count({ where: { companyId: s.companyId } }),
        number = `OC-${String(n + 1).padStart(8, '0')}`;
      const row = await tx.purchaseOrder.create({
        data: {
          companyId: s.companyId,
          branchId: d.branchId,
          supplierId: d.supplierId,
          number,
          notes: d.notes,
          expectedDate: d.expectedDate ? new Date(d.expectedDate) : undefined,
          createdByUserId: s.sub,
          items: {
            create: d.items.map((x) => {
              const q = new Prisma.Decimal(x.quantity),
                cost = new Prisma.Decimal(x.unitCost),
                pct = new Prisma.Decimal(x.discountPercent ?? 0),
                discount = new Prisma.Decimal(x.discountAmount ?? 0);
              return {
                ...x,
                quantity: q,
                unitCost: cost,
                discountPercent: pct,
                discountAmount: discount,
                subtotal: q
                  .mul(cost)
                  .mul(new Prisma.Decimal(1).minus(pct.div(100)))
                  .minus(discount),
              };
            }),
          },
        },
        include: { items: true },
      });
      await this.audit(tx, s, 'PURCHASE_ORDER', row.id, 'PURCHASE_ORDER_CREATED', row, d.branchId);
      return row;
    });
  }
  orders(s: Session) {
    return this.db.purchaseOrder.findMany({
      where: { companyId: s.companyId, branchId: s.branchId ?? undefined },
      include: { supplier: true, branch: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async getOrder(s: Session, id: string) {
    const order = await this.db.purchaseOrder.findFirst({
      where: { id, companyId: s.companyId },
      include: {
        supplier: true,
        branch: true,
        items: { include: { product: true } },
        purchases: { select: { id: true, invoiceNumber: true, status: true } },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }
  async orderStatus(s: Session, id: string, status: PurchaseOrderStatus) {
    const required =
      status === PurchaseOrderStatus.SENT
        ? 'purchaseOrders.send'
        : status === PurchaseOrderStatus.CANCELLED
          ? 'purchaseOrders.cancel'
          : 'purchaseOrders.update';
    if (!s.roles.includes('SUPER_ADMIN') && !s.permissions.includes(required))
      throw new ForbiddenException(`Falta el permiso ${required}`);
    const old = await this.db.purchaseOrder.findFirst({ where: { id, companyId: s.companyId } });
    if (!old) throw new NotFoundException('Orden no encontrada');
    const row = await this.db.purchaseOrder.update({ where: { id }, data: { status } });
    await this.db.auditLog.create({
      data: {
        companyId: s.companyId,
        branchId: old.branchId,
        userId: s.sub,
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        action: status === 'SENT' ? 'PURCHASE_ORDER_SENT' : 'PURCHASE_RECEIVED',
        before: this.json(old),
        after: this.json(row),
      },
    });
    return row;
  }
  async create(s: Session, d: PurchaseDto) {
    await this.context(s, d.branchId, d.supplierId);
    if (!d.items.length) throw new BadRequestException('La compra requiere productos');
    if (d.invoiceNumber) {
      const duplicate = await this.db.purchase.findFirst({
        where: {
          companyId: s.companyId,
          supplierId: d.supplierId,
          invoiceType: d.invoiceType ?? null,
          invoiceNumber: d.invoiceNumber,
        },
      });
      if (duplicate) throw new ConflictException('La factura ya fue registrada');
    }
    return this.db.$transaction(async (tx) => {
      const productIds = d.items.map((x) => x.productId),
        configs = await tx.branchProduct.findMany({
          where: { branchId: d.branchId, productId: { in: productIds }, product: { companyId: s.companyId } },
        }),
        costs = new Map(configs.map((x) => [x.productId, x.cost]));
      const items = d.items.map((x) => {
        const units = new Prisma.Decimal(x.totalUnits),
          cost = new Prisma.Decimal(x.unitCost),
          pct = new Prisma.Decimal(x.discountPercent ?? 0),
          discount = new Prisma.Decimal(x.discountAmount ?? 0),
          subtotal = units.mul(cost),
          total = subtotal.mul(new Prisma.Decimal(1).minus(pct.div(100))).minus(discount);
        return {
          ...x,
          packagesQuantity: x.packagesQuantity,
          totalUnits: units,
          unitCost: cost,
          previousCost: costs.get(x.productId) ?? 0,
          discountPercent: pct,
          discountAmount: discount,
          taxRate: x.taxRate,
          subtotal,
          total,
        };
      });
      const subtotal = items.reduce((a, x) => a.plus(x.subtotal), new Prisma.Decimal(0)),
        discountTotal = items.reduce(
          (a, x) => a.plus(x.discountAmount).plus(x.subtotal.mul(x.discountPercent).div(100)),
          new Prisma.Decimal(0),
        ),
        tax = new Prisma.Decimal(d.taxTotal ?? 0),
        other = new Prisma.Decimal(d.otherCharges ?? 0),
        total = subtotal.minus(discountTotal).plus(tax).plus(other);
      const row = await tx.purchase.create({
        data: {
          companyId: s.companyId,
          branchId: d.branchId,
          supplierId: d.supplierId,
          purchaseOrderId: d.purchaseOrderId,
          invoiceType: d.invoiceType,
          invoiceNumber: d.invoiceNumber,
          invoiceDate: new Date(d.invoiceDate),
          receivedDate: d.receivedDate ? new Date(d.receivedDate) : new Date(),
          taxTotal: tax,
          otherCharges: other,
          subtotal,
          discountTotal,
          total,
          status: PurchaseStatus.REVIEW,
          notes: d.notes,
          createdByUserId: s.sub,
          items: { create: items },
        },
        include: { items: true },
      });
      await this.audit(tx, s, 'PURCHASE', row.id, 'PURCHASE_RECEIVED', row, d.branchId);
      return row;
    });
  }
  async confirm(s: Session, id: string, d: ConfirmDto) {
    const current = await this.get(s, id);
    if (current.status === PurchaseStatus.CONFIRMED)
      return this.db.$transaction(
        async (tx) => {
          await this.stock.receivePurchaseInTransaction(tx, s, current);
          return current;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    if (current.status === PurchaseStatus.CANCELLED) throw new BadRequestException('La compra está cancelada');
    return this.db.$transaction(async (tx) => {
      if (d.applyCosts)
        for (const item of current.items) {
          const bp = await tx.branchProduct.findUnique({
            where: { branchId_productId: { branchId: current.branchId, productId: item.productId } },
          });
          if (!bp || bp.cost.equals(item.unitCost)) continue;
          await tx.branchProduct.update({ where: { id: bp.id }, data: { cost: item.unitCost } });
          await tx.costHistory.create({
            data: {
              productId: item.productId,
              branchId: current.branchId,
              oldCost: bp.cost,
              newCost: item.unitCost,
              percentageChange: bp.cost.eq(0) ? 0 : item.unitCost.minus(bp.cost).div(bp.cost).mul(100),
              source: ChangeSource.PURCHASE,
              changedByUserId: s.sub,
            },
          });
          await tx.supplierProduct.upsert({
            where: { supplierId_productId: { supplierId: current.supplierId, productId: item.productId } },
            update: { lastCost: item.unitCost, lastPurchaseAt: new Date() },
            create: {
              supplierId: current.supplierId,
              productId: item.productId,
              lastCost: item.unitCost,
              lastPurchaseAt: new Date(),
            },
          });
          await this.audit(
            tx,
            s,
            'BRANCH_PRODUCT',
            bp.id,
            'COST_UPDATED_FROM_PURCHASE',
            { purchaseId: id, oldCost: bp.cost, newCost: item.unitCost },
            current.branchId,
          );
        }
      const row = await tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CONFIRMED, confirmedByUserId: s.sub, confirmedAt: new Date() },
      });
      await this.stock.receivePurchaseInTransaction(tx, s, current);
      if (current.purchaseOrderId)
        await tx.purchaseOrder.update({
          where: { id: current.purchaseOrderId },
          data: { status: PurchaseOrderStatus.RECEIVED },
        });
      await tx.invoiceDocument.updateMany({ where: { purchaseId: id }, data: { status: 'CONFIRMED' } });
      await this.audit(tx, s, 'PURCHASE', id, 'PURCHASE_CONFIRMED', row, current.branchId);
      return row;
    });
  }
  async cancel(s: Session, id: string, reason: string) {
    const p = await this.get(s, id);
    if (p.status === PurchaseStatus.CONFIRMED)
      throw new BadRequestException('Una compra confirmada requiere reversión, no cancelación directa');
    const row = await this.db.purchase.update({
      where: { id },
      data: { status: 'CANCELLED', cancellationReason: reason },
    });
    await this.db.auditLog.create({
      data: {
        companyId: s.companyId,
        branchId: p.branchId,
        userId: s.sub,
        entityType: 'PURCHASE',
        entityId: id,
        action: 'PURCHASE_CANCELLED',
        metadata: { reason },
      },
    });
    return row;
  }
  private audit(
    tx: Prisma.TransactionClient,
    s: Session,
    type: string,
    id: string,
    action: string,
    after: unknown,
    branchId?: string,
  ) {
    return tx.auditLog.create({
      data: {
        companyId: s.companyId,
        branchId,
        userId: s.sub,
        entityType: type,
        entityId: id,
        action,
        after: this.json(after),
      },
    });
  }
  private json(x: unknown) {
    return JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
  }
}
@Injectable()
class InvoiceDocumentsService {
  constructor(
    private db: PrismaService,
    private analysis: InvoiceAnalysisService,
  ) {}
  async upload(s: Session, file: UploadedInvoice, supplierId?: string) {
    if (!file) throw new BadRequestException('Archivo requerido');
    const allowed = new Map([
        ['application/pdf', 'pdf'],
        ['image/png', 'png'],
        ['image/jpeg', 'jpg'],
      ]),
      ext = allowed.get(file.mimetype),
      max = Number(process.env.INVOICE_MAX_FILE_MB ?? 15) * 1024 * 1024;
    if (!ext || file.size > max)
      throw new BadRequestException('Archivo inválido: use PDF, JPG o PNG dentro del límite configurado');
    const magic = file.buffer.subarray(0, 8),
      valid =
        ext === 'pdf'
          ? magic.subarray(0, 4).toString() === '%PDF'
          : ext === 'png'
            ? magic.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : magic[0] === 0xff && magic[1] === 0xd8;
    if (!valid) throw new BadRequestException('El contenido no coincide con el MIME informado');
    if (supplierId && !(await this.db.supplier.findFirst({ where: { id: supplierId, companyId: s.companyId } })))
      throw new NotFoundException('Proveedor no encontrado');
    const now = new Date(),
      base = resolve(process.env.INVOICE_UPLOAD_DIR ?? 'uploads/invoices'),
      key = join(
        s.companyId,
        String(now.getUTCFullYear()),
        String(now.getUTCMonth() + 1).padStart(2, '0'),
        `${randomUUID()}.${ext}`,
      ),
      absolute = join(base, key);
    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, file.buffer, { mode: 0o600 });
    const row = await this.db.invoiceDocument.create({
      data: {
        companyId: s.companyId,
        supplierId,
        storageKey: key,
        originalName: file.originalname.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 200),
        mimeType: file.mimetype,
        size: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        status: 'UPLOADED',
      },
    });
    await this.db.auditLog.create({
      data: {
        companyId: s.companyId,
        userId: s.sub,
        entityType: 'INVOICE_DOCUMENT',
        entityId: row.id,
        action: 'INVOICE_UPLOADED',
        after: JSON.parse(JSON.stringify(row)),
      },
    });
    return row;
  }
  async analyze(s: Session, id: string, result?: InvoiceAnalysisResult) {
    const doc = await this.db.invoiceDocument.findFirst({ where: { id, companyId: s.companyId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    await this.db.invoiceDocument.update({ where: { id }, data: { status: 'PROCESSING', errorMessage: null } });
    try {
      const analyzed = result
        ? await this.analysis.analyzeStructured(s.companyId, doc.supplierId ?? undefined, result)
        : await this.analysis.analyze(s.companyId, doc.supplierId ?? undefined, {
            mimeType: doc.mimeType,
            storageKey: doc.storageKey,
            text: doc.extractedText ?? undefined,
          });
      return await this.db.$transaction(async (tx) => {
        await tx.invoiceAnalysisItem.deleteMany({ where: { documentId: id } });
        if (analyzed.items.length)
          await tx.invoiceAnalysisItem.createMany({ data: analyzed.items.map((x) => ({ ...x, documentId: id })) });
        const row = await tx.invoiceDocument.update({
          where: { id },
          data: {
            status: 'REVIEW',
            supplierId: analyzed.supplier?.id ?? doc.supplierId,
            provider: process.env.INVOICE_AI_PROVIDER ?? 'manual',
            analysisResult: JSON.parse(JSON.stringify(analyzed.parsed)),
            warnings: analyzed.warnings,
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            userId: s.sub,
            entityType: 'INVOICE_DOCUMENT',
            entityId: id,
            action: 'INVOICE_ANALYZED',
            after: JSON.parse(JSON.stringify(row)),
          },
        });
        return { ...row, items: analyzed.items };
      });
    } catch (e) {
      await this.db.invoiceDocument.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: e instanceof Error ? e.message : 'Error de análisis' },
      });
      throw e;
    }
  }
  list(s: Session) {
    return this.db.invoiceDocument.findMany({
      where: { companyId: s.companyId },
      include: { supplier: true, purchase: true, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async correct(s: Session, id: string, line: number, d: CorrectionDto) {
    const doc = await this.db.invoiceDocument.findFirst({ where: { id, companyId: s.companyId } }),
      item = await this.db.invoiceAnalysisItem.findUnique({
        where: { documentId_lineNumber: { documentId: id, lineNumber: line } },
      });
    if (!doc || !item) throw new NotFoundException('Línea no encontrada');
    const product = await this.db.product.findFirst({ where: { id: d.productId, companyId: s.companyId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const row = await this.db.invoiceAnalysisItem.update({
      where: { id: item.id },
      data: { matchedProductId: d.productId, status: InvoiceItemStatus.MATCHED, confidence: 1 },
    });
    if (d.learnAlias && doc.supplierId) {
      const normalized = item.rawDescription
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      await this.db.supplierProductAlias.upsert({
        where: { supplierId_normalizedDescription: { supplierId: doc.supplierId, normalizedDescription: normalized } },
        update: { productId: d.productId, rawDescription: item.rawDescription, confidence: 1 },
        create: {
          supplierId: doc.supplierId,
          productId: d.productId,
          rawDescription: item.rawDescription,
          normalizedDescription: normalized,
          confidence: 1,
        },
      });
    }
    return row;
  }
}
@Controller('purchase-orders')
class OrdersController {
  constructor(private svc: PurchasesService) {}
  @Get() @RequirePermissions('purchaseOrders.view') list(@CurrentSession() s: Session) {
    return this.svc.orders(s);
  }
  @Get(':id') @RequirePermissions('purchaseOrders.view') get(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.svc.getOrder(s, id);
  }
  @Post() @RequirePermissions('purchaseOrders.create') create(@CurrentSession() s: Session, @Body() d: OrderDto) {
    return this.svc.order(s, d);
  }
  @Patch(':id/status') @RequirePermissions('purchaseOrders.view') status(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: StatusDto,
  ) {
    return this.svc.orderStatus(s, id, d.status);
  }
}
@Controller('purchases')
class PurchasesController {
  constructor(private svc: PurchasesService) {}
  @Get() @RequirePermissions('purchases.view') list(@CurrentSession() s: Session, @Query() q: Record<string, string>) {
    return this.svc.list(s, q);
  }
  @Get(':id') @RequirePermissions('purchases.view') get(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.svc.get(s, id);
  }
  @Post() @RequirePermissions('purchases.create') create(@CurrentSession() s: Session, @Body() d: PurchaseDto) {
    return this.svc.create(s, d);
  }
  @Post(':id/confirm') @RequirePermissions('purchases.confirm') confirm(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: ConfirmDto,
  ) {
    return this.svc.confirm(s, id, d);
  }
  @Post(':id/cancel') @RequirePermissions('purchases.cancel') cancel(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.svc.cancel(s, id, reason);
  }
}
@Controller('invoice-documents')
class InvoiceController {
  constructor(private svc: InvoiceDocumentsService) {}
  @Get() @RequirePermissions('purchases.view') list(@CurrentSession() s: Session) {
    return this.svc.list(s);
  }
  @Post('upload')
  @RequirePermissions('invoiceAI.use')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  upload(@CurrentSession() s: Session, @UploadedFile() f: UploadedInvoice, @Body('supplierId') supplierId?: string) {
    return this.svc.upload(s, f, supplierId);
  }
  @Post(':id/analyze') @RequirePermissions('invoiceAI.use') analyze(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() result?: InvoiceAnalysisResult,
  ) {
    return this.svc.analyze(s, id, result && Object.keys(result).length ? result : undefined);
  }
  @Patch(':id/items/:line') @RequirePermissions('invoiceAI.review') correct(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('line') line: string,
    @Body() d: CorrectionDto,
  ) {
    return this.svc.correct(s, id, Number(line), d);
  }
}
@Controller('invoices')
class InvoicesAliasController {
  constructor(private svc: InvoiceDocumentsService) {}
  @Get() @RequirePermissions('invoices.view') list(@CurrentSession() s: Session) {
    return this.svc.list(s);
  }
  @Post('upload')
  @RequirePermissions('invoices.upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  upload(@CurrentSession() s: Session, @UploadedFile() f: UploadedInvoice, @Body('supplierId') supplierId?: string) {
    return this.svc.upload(s, f, supplierId);
  }
}
@Controller('invoice-analysis')
class InvoiceAnalysisController {
  constructor(private svc: InvoiceDocumentsService) {}
  @Post(':id/analyze') @RequirePermissions('invoices.analyze') analyze(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() result?: InvoiceAnalysisResult,
  ) {
    return this.svc.analyze(s, id, result && Object.keys(result).length ? result : undefined);
  }
  @Patch(':id/items/:line') @RequirePermissions('invoices.review') correct(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('line') line: string,
    @Body() d: CorrectionDto,
  ) {
    return this.svc.correct(s, id, Number(line), d);
  }
}
@Module({
  imports: [StockModule],
  controllers: [
    OrdersController,
    PurchasesController,
    InvoiceController,
    InvoicesAliasController,
    InvoiceAnalysisController,
  ],
  providers: [PurchasesService, InvoiceDocumentsService, InvoiceAnalysisService, ManualInvoiceAnalyzer],
})
export class PurchasesModule {}
