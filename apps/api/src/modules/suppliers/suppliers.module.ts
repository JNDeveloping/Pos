import {
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
import { Prisma } from '@prisma/client';
import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';

class SupplierDto {
  @IsOptional() @IsString() @Length(2, 30) code?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() salespersonName?: string;
  @IsOptional() @IsString() salespersonPhone?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() visitDays?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class SupplierProductDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsString() supplierCode?: string;
  @IsOptional() @IsString() supplierDescription?: string;
  @IsOptional() @IsString() supplierBarcode?: string;
  @IsOptional() @IsNumberString() lastCost?: string;
  @IsOptional() unitsPerCase?: number;
}
class AliasDto {
  @IsUUID() productId!: string;
  @IsString() @Length(2, 500) rawDescription!: string;
  @IsOptional() @IsNumberString() confidence?: string;
}
export const normalizeSupplierText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

@Injectable()
class SuppliersService {
  constructor(private db: PrismaService) {}
  list(s: Session, search = '', page = 1) {
    const where: Prisma.SupplierWhereInput = {
      companyId: s.companyId,
      deletedAt: null,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { cuit: { contains: search } },
          ]
        : undefined,
    };
    return this.db.$transaction(async (tx) => {
      const [data, total] = await Promise.all([
        tx.supplier.findMany({
          where,
          include: { _count: { select: { products: true, purchases: true } } },
          orderBy: { name: 'asc' },
          skip: (page - 1) * 30,
          take: 30,
        }),
        tx.supplier.count({ where }),
      ]);
      return { data, meta: { page, total, pages: Math.ceil(total / 30) } };
    });
  }
  async get(s: Session, id: string) {
    const row = await this.db.supplier.findFirst({
      where: { id, companyId: s.companyId, deletedAt: null },
      include: {
        products: { include: { product: true } },
        aliases: true,
        _count: { select: { purchases: true, purchaseOrders: true } },
      },
    });
    if (!row) throw new NotFoundException('Proveedor no encontrado');
    return row;
  }
  async create(s: Session, dto: SupplierDto) {
    return this.db.$transaction(async (tx) => {
      let code = dto.code?.toUpperCase();
      if (!code) {
        const count = await tx.supplier.count({ where: { companyId: s.companyId } });
        code = `PROV-${String(count + 1).padStart(6, '0')}`;
        while (await tx.supplier.findUnique({ where: { companyId_code: { companyId: s.companyId, code } } }))
          code = `PROV-${String(Number(code.slice(5)) + 1).padStart(6, '0')}`;
      }
      const row = await tx.supplier.create({ data: { ...dto, code, companyId: s.companyId } });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'SUPPLIER',
          entityId: row.id,
          action: 'SUPPLIER_CREATED',
          after: this.json(row),
        },
      });
      return row;
    });
  }
  async update(s: Session, id: string, dto: Partial<SupplierDto>) {
    const old = await this.get(s, id);
    return this.db.$transaction(async (tx) => {
      const row = await tx.supplier.update({ where: { id }, data: { ...dto, code: dto.code?.toUpperCase() } });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'SUPPLIER',
          entityId: id,
          action: 'SUPPLIER_UPDATED',
          before: this.json(old),
          after: this.json(row),
        },
      });
      return row;
    });
  }
  async link(s: Session, id: string, dto: SupplierProductDto) {
    await this.get(s, id);
    const product = await this.db.product.findFirst({
      where: { id: dto.productId, companyId: s.companyId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.db.$transaction(async (tx) => {
      const row = await tx.supplierProduct.upsert({
        where: { supplierId_productId: { supplierId: id, productId: dto.productId } },
        update: { ...dto, lastCost: dto.lastCost },
        create: { ...dto, lastCost: dto.lastCost, supplierId: id },
      });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'SUPPLIER_PRODUCT',
          entityId: row.id,
          action: 'SUPPLIER_PRODUCT_LINKED',
          after: this.json(row),
        },
      });
      return row;
    });
  }
  async alias(s: Session, id: string, dto: AliasDto) {
    await this.get(s, id);
    const normalizedDescription = normalizeSupplierText(dto.rawDescription);
    return this.db.$transaction(async (tx) => {
      const row = await tx.supplierProductAlias.upsert({
        where: { supplierId_normalizedDescription: { supplierId: id, normalizedDescription } },
        update: {
          productId: dto.productId,
          rawDescription: dto.rawDescription,
          confidence: dto.confidence,
          source: 'MANUAL',
        },
        create: {
          supplierId: id,
          productId: dto.productId,
          rawDescription: dto.rawDescription,
          normalizedDescription,
          confidence: dto.confidence,
          source: 'MANUAL',
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'SUPPLIER_ALIAS',
          entityId: row.id,
          action: 'INVOICE_MATCH_CORRECTED',
          after: this.json(row),
        },
      });
      return row;
    });
  }
  private json(v: unknown) {
    return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
  }
}
@Controller('suppliers')
class SuppliersController {
  constructor(private svc: SuppliersService) {}
  @Get() @RequirePermissions('suppliers.view') list(
    @CurrentSession() s: Session,
    @Query('search') q?: string,
    @Query('page') p?: string,
  ) {
    return this.svc.list(s, q, Number(p || 1));
  }
  @Get(':id') @RequirePermissions('suppliers.view') get(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.svc.get(s, id);
  }
  @Post() @RequirePermissions('suppliers.create') create(@CurrentSession() s: Session, @Body() d: SupplierDto) {
    return this.svc.create(s, d);
  }
  @Patch(':id') @RequirePermissions('suppliers.update') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: Partial<SupplierDto>,
  ) {
    return this.svc.update(s, id, d);
  }
  @Delete(':id') @RequirePermissions('suppliers.disable') disable(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    return this.svc.update(s, id, { active: false });
  }
  @Post(':id/products') @RequirePermissions('suppliers.update') link(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: SupplierProductDto,
  ) {
    return this.svc.link(s, id, d);
  }
  @Post(':id/aliases') @RequirePermissions('invoiceAI.review') alias(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: AliasDto,
  ) {
    return this.svc.alias(s, id, d);
  }
}
@Module({ controllers: [SuppliersController], providers: [SuppliersService], exports: [SuppliersService] })
export class SuppliersModule {}
