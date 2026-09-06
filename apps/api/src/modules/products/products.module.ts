import { ApiTags } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BarcodeType, ChangeSource, NetContentUnit, PresentationType, Prisma, UnitType } from '@prisma/client';
import {
  IsBoolean,
  IsArray,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Matches,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { CurrentSession, RequirePermissions, Session, sessionCan } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
export const optionalBoolean = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === '' ? undefined : value === true || value === 'true';
class ProductBranchDto {
  @IsUUID() branchId!: string;
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsNumberString() salePrice?: string;
  @IsOptional() @IsNumberString() stockMinimum?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() posFavorite?: boolean;
  @IsOptional() @IsBoolean() allowManualPrice?: boolean;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() shelf?: string;
  @IsOptional() @IsNumberString() saleFloorStock?: string;
  @IsOptional() @IsNumberString() warehouseStock?: string;
}
class ProductDto {
  @IsOptional() @IsString() @Length(2, 50) internalCode?: string;
  @IsString() @Length(2, 180) name!: string;
  @IsOptional() @IsString() @Length(1, 80) shortName?: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() subcategoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() familyId?: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(UnitType) unitType: UnitType = UnitType.UNIT;
  @IsNumberString() taxRate = '21';
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() supplierReference?: string;
  @IsOptional() @IsEnum(PresentationType) presentationType?: PresentationType;
  @IsOptional() @IsNumberString() netContent?: string;
  @IsOptional() @IsEnum(NetContentUnit) netContentUnit?: NetContentUnit;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) unitsPerCase?: number;
  @IsOptional() @IsString() caseBarcode?: string;
  @IsOptional() @IsBoolean() isWeighted?: boolean;
  @IsOptional() @IsBoolean() allowManualPriceDefault?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() @Matches(/^\d+$/, { message: 'El código debe ser numérico' }) barcode?: string;
  @IsOptional() @ValidateNested() @Type(() => ProductBranchDto) branchConfig?: ProductBranchDto;
}
class QuickProductDto {
  @IsString() @Length(2, 180) name!: string;
  @IsString() @Matches(/^\d+$/, { message: 'El código debe ser numérico' }) barcode!: string;
  @IsNumberString() salePrice!: string;
  @IsUUID() branchId!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsNumberString() initialStock?: string;
  @IsOptional() @IsString() imageUrl?: string;
}
class ProductPatchDto {
  @IsOptional() @IsString() @Length(2, 50) internalCode?: string;
  @IsOptional() @IsString() @Length(2, 180) name?: string;
  @IsOptional() @IsString() @Length(1, 80) shortName?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() subcategoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() familyId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() supplierReference?: string;
  @IsOptional() @IsEnum(PresentationType) presentationType?: PresentationType;
  @IsOptional() @IsNumberString() netContent?: string;
  @IsOptional() @IsEnum(NetContentUnit) netContentUnit?: NetContentUnit;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) unitsPerCase?: number;
  @IsOptional() @IsString() caseBarcode?: string;
  @IsOptional() @IsBoolean() isWeighted?: boolean;
  @IsOptional() @IsBoolean() allowManualPriceDefault?: boolean;
  @IsOptional() @IsString() notes?: string;
}
class BarcodeDto {
  @IsString() @Length(1, 64) @Matches(/^\d+$/, { message: 'El código debe ser numérico' }) barcode!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsEnum(BarcodeType) type?: BarcodeType;
}
class ConfigDto {
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsNumberString() salePrice?: string;
  @IsOptional() @IsNumberString() margin?: string;
  @IsOptional() @IsNumberString() stockMinimum?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() posFavorite?: boolean;
  @IsOptional() @IsBoolean() allowManualPrice?: boolean;
  @IsOptional() @IsBoolean() queueLabel?: boolean;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() shelf?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsEnum(ChangeSource) source?: ChangeSource;
}
class ListQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() subcategoryId?: string;
  @IsOptional() @IsEnum(PresentationType) presentationType?: PresentationType;
  @IsOptional() @Transform(optionalBoolean) @IsBoolean() withoutPrice?: boolean;
  @IsOptional() @Transform(optionalBoolean) @IsBoolean() withoutCost?: boolean;
  @IsOptional() @Transform(optionalBoolean) @IsBoolean() withoutBarcode?: boolean;
  @IsOptional() @Transform(optionalBoolean) @IsBoolean() posFavorite?: boolean;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @Transform(optionalBoolean) @IsBoolean() enabled?: boolean;
  @IsOptional() @Transform(optionalBoolean) @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
class ImportRowDto {
  @IsString() @Length(1, 64) codigo!: string;
  @IsString() @Length(2, 180) descripcion!: string;
  @IsString() @Length(1, 100) rubro!: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() subcategoria?: string;
  @IsOptional() @IsNumberString() costo?: string;
  @IsOptional() @IsNumberString() precio?: string;
  @IsOptional() @IsEnum(PresentationType) presentacion?: PresentationType;
  @IsOptional() @IsNumberString() contenido?: string;
  @IsOptional() @IsEnum(NetContentUnit) unidad?: NetContentUnit;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) unidadesPorBulto?: number;
  @IsOptional() @IsString() barcodeBulto?: string;
  @IsOptional() @IsNumberString() iva?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() ubicacion?: string;
}
class ImportBatchDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ImportRowDto) rows!: ImportRowDto[];
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() enableForBranch?: boolean;
}
@ApiTags('Productos')
@Controller('products')
export class ProductsController {
  constructor(private db: PrismaService) {}
  private include = {
    category: true,
    subcategory: true,
    brand: true,
    family: true,
    supplierProducts: { include: { supplier: true }, orderBy: { preferredSupplier: 'desc' } },
    barcodes: true,
    branchConfigs: { include: { branch: true } },
    _count: { select: { branchConfigs: { where: { enabled: true } } } },
  } as const;
  @Get() @RequirePermissions('products.view') async list(@CurrentSession() s: Session, @Query() q: ListQuery) {
    if (s.branchId && q.branchId && s.branchId !== q.branchId)
      throw new ForbiddenException('Sucursal fuera de su alcance');
    const branchId = s.branchId ?? q.branchId;
    const branchConditions: Prisma.ProductWhereInput[] = [];
    if (q.withoutPrice)
      branchConditions.push({ branchConfigs: { some: { ...(branchId ? { branchId } : {}), salePrice: 0 } } });
    if (q.withoutCost)
      branchConditions.push({ branchConfigs: { some: { ...(branchId ? { branchId } : {}), cost: 0 } } });
    if (q.posFavorite)
      branchConditions.push({ branchConfigs: { some: { ...(branchId ? { branchId } : {}), posFavorite: true } } });
    if (branchId)
      branchConditions.push({
        branchConfigs:
          q.enabled === false
            ? { none: { branchId, enabled: true } }
            : { some: { branchId, ...(q.enabled === true ? { enabled: true } : {}) } },
      });
    const where: Prisma.ProductWhereInput = {
      companyId: s.companyId,
      deletedAt: null,
      ...(q.active !== undefined ? { active: q.active } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(q.subcategoryId ? { subcategoryId: q.subcategoryId } : {}),
      ...(q.presentationType ? { presentationType: q.presentationType } : {}),
      ...(q.withoutBarcode ? { barcodes: { none: {} } } : {}),
      ...(branchConditions.length ? { AND: branchConditions } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { shortName: { contains: q.search, mode: 'insensitive' } },
              { sku: { contains: q.search, mode: 'insensitive' } },
              { internalCode: { contains: q.search, mode: 'insensitive' } },
              { barcodes: { some: { barcode: { contains: q.search } } } },
              {
                supplierProducts: {
                  some: {
                    OR: [
                      { supplierCode: { contains: q.search, mode: 'insensitive' } },
                      { supplierBarcode: { contains: q.search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.db.$transaction([
      this.db.product.findMany({
        where,
        include: this.include,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { name: 'asc' },
      }),
      this.db.product.count({ where }),
    ]);
    const canViewCosts = sessionCan(s, 'costs.view');
    const safeData = canViewCosts
      ? data
      : data.map((product) => ({
          ...product,
          branchConfigs: product.branchConfigs.map(({ cost: _cost, ...config }) => config),
        }));
    return { data: safeData, meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
  }
  @Post('quick') @RequirePermissions('products.create') async quickCreate(
    @CurrentSession() s: Session,
    @Body() d: QuickProductDto,
  ) {
    let categoryId = d.categoryId;
    if (!categoryId) {
      const category = await this.db.category.findFirst({
        where: { companyId: s.companyId, deletedAt: null, name: { equals: 'Sin clasificar', mode: 'insensitive' } },
      }) ?? await this.db.category.create({ data: { companyId: s.companyId, name: 'Sin clasificar' } });
      categoryId = category.id;
    }
    return this.create(s, {
      name: d.name,
      barcode: d.barcode,
      categoryId,
      imageUrl: d.imageUrl,
      unitType: UnitType.UNIT,
      taxRate: '21',
      branchConfig: {
        branchId: d.branchId,
        salePrice: d.salePrice,
        cost: d.cost,
        saleFloorStock: d.initialStock,
        warehouseStock: '0',
        enabled: true,
      },
    });
  }
  @Post('bulk-disable') @RequirePermissions('products.disable') async bulkDisable(
    @CurrentSession() s: Session,
    @Body('productIds') productIds: string[],
  ) {
    if (!Array.isArray(productIds) || !productIds.length || productIds.length > 1000)
      throw new BadRequestException('Selección inválida');
    const now = new Date();
    const result = await this.db.product.updateMany({
      where: { companyId: s.companyId, id: { in: productIds }, deletedAt: null },
      data: { active: false, deletedAt: now },
    });
    await this.db.auditLog.create({
      data: {
        companyId: s.companyId,
        userId: s.sub,
        entityType: 'PRODUCT',
        entityId: s.companyId,
        action: 'PRODUCTS_BULK_DISABLED',
        metadata: { count: result.count },
      },
    });
    return result;
  }
  @Get('bulk-delete-all/summary') @RequirePermissions('products.disable') async deleteAllSummary(
    @CurrentSession() s: Session,
  ) {
    if (!s.roles.includes('SUPER_ADMIN')) throw new ForbiddenException('Sólo SUPER_ADMIN puede eliminar todo el catálogo');
    return { count: await this.db.product.count({ where: { companyId: s.companyId, deletedAt: null } }) };
  }
  @Post('bulk-delete-all') @RequirePermissions('products.disable') async deleteAll(
    @CurrentSession() s: Session,
    @Body('confirmation') confirmation: string,
  ) {
    if (!s.roles.includes('SUPER_ADMIN')) throw new ForbiddenException('Sólo SUPER_ADMIN puede eliminar todo el catálogo');
    if (confirmation !== 'ELIMINAR') throw new BadRequestException('Confirmación inválida');
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const products = await tx.product.updateMany({
        where: { companyId: s.companyId, deletedAt: null },
        data: { active: false, deletedAt: now },
      });
      await tx.branchProduct.updateMany({
        where: { branch: { companyId: s.companyId }, product: { deletedAt: now } },
        data: { enabled: false },
      });
      await tx.auditLog.create({
        data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: s.companyId, action: 'ALL_PRODUCTS_DISABLED', metadata: { count: products.count } },
      });
      return { count: products.count };
    }, { timeout: 60000 });
  }
  @Get(':id') @RequirePermissions('products.view') async one(@CurrentSession() s: Session, @Param('id') id: string) {
    const p = await this.db.product.findFirst({
      where: { id, companyId: s.companyId, deletedAt: null },
      include: this.include,
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (sessionCan(s, 'costs.view')) return p;
    return { ...p, branchConfigs: p.branchConfigs.map(({ cost: _cost, ...config }) => config) };
  }
  @Post() @RequirePermissions('products.create') async create(@CurrentSession() s: Session, @Body() d: ProductDto) {
    await this.validateRefs(s, d.categoryId, d.brandId, d.subcategoryId);
    if (d.caseBarcode) await this.ensureBarcodeAvailable(s, d.caseBarcode);
    if (d.barcode) await this.ensureBarcodeAvailable(s, d.barcode);
    if (d.branchConfig) {
      const branch = await this.db.branch.findFirst({
        where: { id: d.branchConfig.branchId, companyId: s.companyId, active: true, deletedAt: null },
      });
      if (!branch || (s.branchId && s.branchId !== branch.id)) throw new NotFoundException('Sucursal no encontrada');
      if (d.branchConfig.cost !== undefined && !sessionCan(s, 'costs.update'))
        throw new ForbiddenException('No tiene permiso para modificar costos');
      if (d.branchConfig.salePrice !== undefined && !sessionCan(s, 'prices.update'))
        throw new ForbiddenException('No tiene permiso para modificar precios');
    }
    return this.db.$transaction(async (tx) => {
      const { barcode, branchConfig, ...productInput } = d;
      const sequence = d.internalCode
        ? undefined
        : await tx.company.update({
            where: { id: s.companyId },
            data: { productSequence: { increment: 1 } },
            select: { productSequence: true },
          });
      const product = await tx.product.create({
        data: {
          ...productInput,
          internalCode: d.internalCode?.toUpperCase() ?? `PROD-${String(sequence!.productSequence).padStart(6, '0')}`,
          taxRate: new Prisma.Decimal(d.taxRate),
          companyId: s.companyId,
        },
      });
      if (barcode)
        await tx.productBarcode.create({
          data: { companyId: s.companyId, productId: product.id, barcode, isPrimary: true },
        });
      if (d.caseBarcode)
        await tx.productBarcode.create({
          data: { companyId: s.companyId, productId: product.id, barcode: d.caseBarcode, type: BarcodeType.CASE },
        });
      if (branchConfig) {
        const cost = this.money(branchConfig.cost ?? 0),
          price = this.money(branchConfig.salePrice ?? 0),
          margin = cost.gt(0) ? price.minus(cost).div(cost).mul(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
        await tx.branchProduct.create({
          data: {
            branchId: branchConfig.branchId,
            productId: product.id,
            cost,
            salePrice: price,
            margin,
            stockMinimum: this.money(branchConfig.stockMinimum ?? 0),
            enabled: branchConfig.enabled ?? true,
            posFavorite: branchConfig.posFavorite ?? false,
            allowManualPrice: branchConfig.allowManualPrice,
            location: branchConfig.location,
            shelf: branchConfig.shelf,
          },
        });
        await tx.labelPrintQueue.create({ data: { companyId: s.companyId, branchId: branchConfig.branchId, productId: product.id, userId: s.sub, oldPrice: price, newPrice: price } });
        const saleFloor = new Prisma.Decimal(branchConfig.saleFloorStock ?? 0),
          warehouse = new Prisma.Decimal(branchConfig.warehouseStock ?? 0),
          total = saleFloor.plus(warehouse);
        if (saleFloor.lt(0) || warehouse.lt(0)) throw new BadRequestException('El stock inicial no puede ser negativo');
        if (total.gt(0)) {
          await tx.stock.create({ data: { companyId: s.companyId, branchId: branchConfig.branchId, productId: product.id, quantity: total } });
          await tx.stockLocationBalance.createMany({ data: [
            { companyId: s.companyId, branchId: branchConfig.branchId, productId: product.id, location: 'SALE_FLOOR', quantity: saleFloor },
            { companyId: s.companyId, branchId: branchConfig.branchId, productId: product.id, location: 'WAREHOUSE', quantity: warehouse },
          ] });
          await tx.stockMovement.create({ data: { companyId: s.companyId, branchId: branchConfig.branchId, productId: product.id, type: 'INITIAL_STOCK', quantity: total, previousQuantity: 0, newQuantity: total, reason: 'Alta de producto', userId: s.sub, metadata: { saleFloor: saleFloor.toString(), warehouse: warehouse.toString() } } });
        }
      }
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'PRODUCT',
          entityId: product.id,
          action: 'PRODUCT_CREATED',
          after: this.json(product),
        },
      });
      return product;
    });
  }
  @Post('image') @RequirePermissions('products.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  async uploadImage(@CurrentSession() s: Session, @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new BadRequestException('Seleccione una imagen');
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Use una imagen JPG, PNG o WebP');
    const valid = (extension === 'jpg' && file.buffer[0] === 0xff && file.buffer[1] === 0xd8) ||
      (extension === 'png' && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (extension === 'webp' && file.buffer.subarray(0, 4).toString() === 'RIFF' && file.buffer.subarray(8, 12).toString() === 'WEBP');
    if (!valid) throw new BadRequestException('El archivo no contiene una imagen válida');
    const directory = resolve(process.cwd(), 'uploads/public/products', s.companyId);
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(resolve(directory, filename), file.buffer, { flag: 'wx' });
    return { url: `/api/uploads/products/${s.companyId}/${filename}` };
  }
  @Get('export/data') @RequirePermissions('products.export') async exportData(
    @CurrentSession() s: Session,
    @Query('branchId') branchId?: string,
  ) {
    return this.db.product.findMany({
      where: { companyId: s.companyId, deletedAt: null },
      select: {
        internalCode: true,
        name: true,
        shortName: true,
        sku: true,
        presentationType: true,
        netContent: true,
        netContentUnit: true,
        taxRate: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        brand: { select: { name: true } },
        barcodes: { orderBy: { isPrimary: 'desc' }, take: 1, select: { barcode: true } },
        branchConfigs: {
          where: branchId ? { branchId } : undefined,
          select: { cost: sessionCan(s, 'costs.view'), salePrice: true, margin: true, location: true },
        },
      },
      take: 50000,
      orderBy: { name: 'asc' },
    });
  }
  @Post('import') @RequirePermissions('products.import') async importBatch(
    @CurrentSession() s: Session,
    @Body() d: ImportBatchDto,
  ) {
    if (d.enableForBranch && !d.branchId) throw new BadRequestException('Debe indicar la sucursal a habilitar');
    if (d.branchId) {
      const branch = await this.db.branch.findFirst({
        where: { id: d.branchId, companyId: s.companyId, active: true, deletedAt: null },
      });
      if (!branch) throw new NotFoundException('Sucursal no encontrada');
    }
    const result = {
      created: 0,
      updated: 0,
      categoriesCreated: 0,
      brandsCreated: 0,
      skipped: 0,
      warnings: [] as string[],
      errors: [] as string[],
    };
    for (const row of d.rows) {
      const barcode = row.codigo.trim();
      if (!/^\d+$/.test(barcode)) {
        result.skipped++;
        result.errors.push(`${barcode}: el código debe ser numérico`);
        continue;
      }
      if (!/^\d{13}$/.test(barcode)) result.warnings.push(`${barcode}: código comercial no EAN-13`);
      try {
        await this.db.$transaction(async (tx) => {
          const categoryName = this.normalizeCategory(row.rubro);
          const categoryKey = this.categoryKey(row.rubro);
          let category = await tx.category.findFirst({
            where: {
              companyId: s.companyId,
              parentId: null,
              deletedAt: null,
              name: { in: [categoryName, categoryKey], mode: 'insensitive' },
            },
          });
          if (!category) {
            category = await tx.category.create({ data: { companyId: s.companyId, name: categoryName } });
            result.categoriesCreated++;
          } else if (category.name !== categoryName) {
            category = await tx.category.update({ where: { id: category.id }, data: { name: categoryName } });
          }
          let subcategory;
          if (row.subcategoria) {
            subcategory = await tx.category.findFirst({
              where: {
                companyId: s.companyId,
                parentId: category.id,
                name: { equals: row.subcategoria.trim(), mode: 'insensitive' },
                deletedAt: null,
              },
            });
            if (!subcategory)
              subcategory = await tx.category.create({
                data: { companyId: s.companyId, parentId: category.id, name: row.subcategoria.trim() },
              });
          }
          let brand;
          if (row.marca) {
            brand = await tx.brand.findFirst({
              where: {
                companyId: s.companyId,
                name: { equals: row.marca.trim(), mode: 'insensitive' },
                deletedAt: null,
              },
            });
            if (!brand) {
              brand = await tx.brand.create({ data: { companyId: s.companyId, name: row.marca.trim() } });
              result.brandsCreated++;
            }
          }
          const barcodeRecord = await tx.productBarcode.findUnique({
            where: { companyId_barcode: { companyId: s.companyId, barcode } },
            include: { product: true },
          });
          let product;
          if (barcodeRecord) {
            product = await tx.product.update({
              where: { id: barcodeRecord.productId },
              data: {
                name: row.descripcion.trim(),
                categoryId: category.id,
                subcategoryId: subcategory?.id,
                brandId: brand?.id,
                presentationType: row.presentacion,
                netContent: row.contenido,
                netContentUnit: row.unidad,
                unitsPerCase: row.unidadesPorBulto,
                caseBarcode: row.barcodeBulto,
                taxRate: row.iva,
                sku: row.sku,
                active: true,
                deletedAt: null,
              },
            });
            result.updated++;
          } else {
            product = await tx.product.create({
              data: {
                companyId: s.companyId,
                internalCode: barcode,
                name: row.descripcion.trim(),
                categoryId: category.id,
                subcategoryId: subcategory?.id,
                brandId: brand?.id,
                presentationType: row.presentacion,
                netContent: row.contenido,
                netContentUnit: row.unidad,
                unitsPerCase: row.unidadesPorBulto,
                caseBarcode: row.barcodeBulto,
                taxRate: row.iva,
                sku: row.sku,
                barcodes: {
                  create: [
                    {
                      companyId: s.companyId,
                      barcode,
                      isPrimary: true,
                      type: barcode.length === 13 ? BarcodeType.EAN13 : BarcodeType.OTHER,
                    },
                    ...(row.barcodeBulto && row.barcodeBulto !== barcode
                      ? [
                          {
                            companyId: s.companyId,
                            barcode: row.barcodeBulto,
                            isPrimary: false,
                            type: BarcodeType.CASE,
                          },
                        ]
                      : []),
                  ],
                },
              },
            });
            result.created++;
          }
          if (d.enableForBranch && d.branchId)
            await tx.branchProduct.upsert({
              where: { branchId_productId: { branchId: d.branchId, productId: product.id } },
              create: {
                branchId: d.branchId,
                productId: product.id,
                enabled: true,
                cost: row.costo ?? 0,
                salePrice: row.precio ?? 0,
                margin:
                  row.costo && row.precio && Number(row.costo) > 0
                    ? ((Number(row.precio) - Number(row.costo)) / Number(row.costo)) * 100
                    : 0,
                location: row.ubicacion,
              },
              update: {
                enabled: true,
                ...(row.costo ? { cost: row.costo } : {}),
                ...(row.precio ? { salePrice: row.precio } : {}),
                ...(row.ubicacion ? { location: row.ubicacion } : {}),
              },
            });
          await tx.auditLog.create({
            data: {
              companyId: s.companyId,
              branchId: d.branchId,
              userId: s.sub,
              entityType: 'PRODUCT',
              entityId: product.id,
              action: 'IMPORT_EXECUTED',
              metadata: { barcode },
            },
          });
        });
      } catch (error) {
        result.skipped++;
        result.errors.push(`${barcode}: ${error instanceof Error ? error.message : 'error de importación'}`);
      }
    }
    return result;
  }
  @Post(':id/duplicate') @RequirePermissions('products.create') async duplicate(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() body: { name?: string; copyBranchConfig?: boolean },
  ) {
    const source = await this.db.product.findFirst({
      where: { id, companyId: s.companyId, deletedAt: null },
      include: { branchConfigs: true },
    });
    if (!source) throw new NotFoundException('Producto no encontrado');
    return this.db.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: s.companyId },
        data: { productSequence: { increment: 1 } },
        select: { productSequence: true },
      });
      const { branchConfigs } = source;
      const product = await tx.product.create({
        data: {
          companyId: s.companyId,
          internalCode: `PROD-${String(company.productSequence).padStart(6, '0')}`,
          name: body.name?.trim() || `${source.name} (copia)`,
          shortName: source.shortName,
          description: source.description,
          categoryId: source.categoryId,
          subcategoryId: source.subcategoryId,
          brandId: source.brandId,
          unitType: source.unitType,
          presentationType: source.presentationType,
          netContent: source.netContent,
          netContentUnit: source.netContentUnit,
          taxRate: source.taxRate,
          imageUrl: source.imageUrl,
          sku: source.sku,
          supplierReference: source.supplierReference,
          unitsPerCase: source.unitsPerCase,
          caseBarcode: source.caseBarcode,
          isWeighted: source.isWeighted,
          allowManualPriceDefault: source.allowManualPriceDefault,
          notes: source.notes,
          active: true,
        },
      });
      if (body.copyBranchConfig)
        await tx.branchProduct.createMany({
          data: branchConfigs.map(
            ({ id: _configId, productId: _productId, createdAt: _cc, updatedAt: _cu, ...config }) => ({
              ...config,
              productId: product.id,
            }),
          ),
        });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'PRODUCT',
          entityId: product.id,
          action: 'PRODUCT_CREATED',
          metadata: { duplicatedFrom: id },
        },
      });
      return product;
    });
  }
  @Patch(':id') @RequirePermissions('products.update') async update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: ProductPatchDto,
  ) {
    await this.owned(s, id);
    const before = await this.owned(s, id);
    if (d.caseBarcode && d.caseBarcode !== before.caseBarcode) await this.ensureBarcodeAvailable(s, d.caseBarcode, id);
    if (d.categoryId) await this.validateRefs(s, d.categoryId, d.brandId, d.subcategoryId);
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          ...d,
          internalCode: d.internalCode?.toUpperCase(),
          taxRate: d.taxRate ? new Prisma.Decimal(d.taxRate) : undefined,
        },
      });
      if (d.caseBarcode !== undefined && d.caseBarcode !== before.caseBarcode) {
        await tx.productBarcode.deleteMany({ where: { productId: id, type: BarcodeType.CASE } });
        if (d.caseBarcode)
          await tx.productBarcode.create({
            data: { companyId: s.companyId, productId: id, barcode: d.caseBarcode, type: BarcodeType.CASE },
          });
      }
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'PRODUCT',
          entityId: id,
          action: 'PRODUCT_UPDATED',
          before: this.json(before),
          after: this.json(product),
        },
      });
      return product;
    });
  }
  @Delete(':id') @RequirePermissions('products.disable') async remove(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'PRODUCT',
          entityId: id,
          action: 'PRODUCT_DISABLED',
          after: this.json(product),
        },
      });
      return product;
    });
  }
  @Get(':id/barcodes') @RequirePermissions('products.view') async barcodes(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    return this.db.productBarcode.findMany({
      where: { productId: id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }
  @Post(':id/barcodes') @RequirePermissions('products.update') async addBarcode(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: BarcodeDto,
  ) {
    await this.owned(s, id);
    await this.ensureBarcodeAvailable(s, d.barcode, id);
    return this.db.$transaction(async (tx) => {
      if (d.isPrimary) await tx.productBarcode.updateMany({ where: { productId: id }, data: { isPrimary: false } });
      const barcode = await tx.productBarcode.create({ data: { ...d, companyId: s.companyId, productId: id } });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'PRODUCT',
          entityId: id,
          action: 'BARCODE_ADDED',
          after: this.json(barcode),
        },
      });
      return barcode;
    });
  }
  @Delete(':id/barcodes/:barcodeId') @RequirePermissions('products.update') async deleteBarcode(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('barcodeId') barcodeId: string,
  ) {
    await this.owned(s, id);
    return this.db.$transaction(async (tx) => {
      const barcode = await tx.productBarcode.delete({ where: { id: barcodeId, productId: id } });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'PRODUCT',
          entityId: id,
          action: 'BARCODE_REMOVED',
          before: this.json(barcode),
        },
      });
      return barcode;
    });
  }
  @Get(':id/branches') @RequirePermissions('products.view') async branches(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    const configs = await this.db.branchProduct.findMany({
      where: { productId: id },
      include: { branch: true },
      orderBy: { branch: { name: 'asc' } },
    });
    return sessionCan(s, 'costs.view') ? configs : configs.map(({ cost: _cost, ...config }) => config);
  }
  @Patch(':id/branches/:branchId') @RequirePermissions('products.update') async branch(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() d: ConfigDto,
  ) {
    if (d.cost !== undefined && !sessionCan(s, 'costs.update'))
      throw new ForbiddenException('No tiene permiso para modificar costos');
    if ((d.salePrice !== undefined || d.margin !== undefined) && !sessionCan(s, 'prices.update'))
      throw new ForbiddenException('No tiene permiso para modificar precios');
    await this.owned(s, id);
    const branch = await this.db.branch.findFirst({ where: { id: branchId, companyId: s.companyId, deletedAt: null } });
    if (!branch || (s.branchId && s.branchId !== branchId)) throw new NotFoundException('Sucursal no encontrada');
    return this.db.$transaction(async (tx) => {
      const current = await tx.branchProduct.findUnique({ where: { branchId_productId: { branchId, productId: id } } });
      const cost = this.money(d.cost ?? current?.cost ?? 0),
        price =
          d.salePrice !== undefined
            ? this.money(d.salePrice)
            : d.margin !== undefined
              ? this.money(cost.mul(new Prisma.Decimal(1).plus(new Prisma.Decimal(d.margin).div(100))))
              : this.money(current?.salePrice ?? 0);
      const margin = cost.gt(0) ? price.minus(cost).div(cost).mul(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
      const config = await tx.branchProduct.upsert({
        where: { branchId_productId: { branchId, productId: id } },
        create: {
          branchId,
          productId: id,
          cost,
          salePrice: price,
          margin,
          stockMinimum: this.money(d.stockMinimum ?? 0),
          enabled: d.enabled ?? true,
          posFavorite: d.posFavorite ?? false,
          allowManualPrice: d.allowManualPrice,
          location: d.location,
          shelf: d.shelf,
          internalNotes: d.internalNotes,
        },
        update: {
          cost,
          salePrice: price,
          margin,
          stockMinimum: d.stockMinimum !== undefined ? this.money(d.stockMinimum) : undefined,
          enabled: d.enabled,
          posFavorite: d.posFavorite,
          allowManualPrice: d.allowManualPrice,
          location: d.location,
          shelf: d.shelf,
          internalNotes: d.internalNotes,
        },
      });
      if (current && !current.salePrice.equals(price))
        await tx.priceHistory.create({
          data: {
            productId: id,
            branchId,
            oldPrice: current.salePrice,
            newPrice: price,
            percentageChange: this.percentage(current.salePrice, price),
            source: d.source ?? ChangeSource.MANUAL,
            changedByUserId: s.sub,
          },
        });
      if (current && !current.salePrice.equals(price) && d.queueLabel)
        await tx.labelPrintQueue.create({
          data: {
            companyId: s.companyId,
            branchId,
            productId: id,
            userId: s.sub,
            oldPrice: current.salePrice,
            newPrice: price,
          },
        });
      if (current && !current.cost.equals(cost))
        await tx.costHistory.create({
          data: {
            productId: id,
            branchId,
            oldCost: current.cost,
            newCost: cost,
            percentageChange: this.percentage(current.cost, cost),
            source: d.source ?? ChangeSource.MANUAL,
            changedByUserId: s.sub,
          },
        });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          branchId,
          userId: s.sub,
          entityType: 'BRANCH_PRODUCT',
          entityId: config.id,
          action: current ? 'BRANCH_PRODUCT_UPDATED' : 'PRODUCT_ENABLED',
          before: current ? this.json(current) : undefined,
          after: this.json(config),
        },
      });
      return config;
    });
  }
  @Get(':id/price-history') @RequirePermissions('prices.view') async prices(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    return this.db.priceHistory.findMany({
      where: { productId: id },
      include: { branch: { select: { name: true } }, changedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get(':id/cost-history') @RequirePermissions('costs.view') async costs(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    return this.db.costHistory.findMany({
      where: { productId: id },
      include: { branch: { select: { name: true } }, changedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  private money(v: string | number | Prisma.Decimal) {
    const n = new Prisma.Decimal(v);
    if (n.lt(0)) throw new BadRequestException('Los importes no pueden ser negativos');
    return n.toDecimalPlaces(2);
  }
  private normalizeCategory(value: string) {
    const key = this.categoryKey(value);
    return (
      (
        {
          ALMACEN: 'ALMACÉN',
          PERFUMERIA: 'PERFUMERÍA',
          LACTEOS: 'LÁCTEOS',
          'SIN CLASIFICAR': 'SIN CLASIFICAR',
        } as Record<string, string>
      )[key] ?? key
    );
  }
  private categoryKey(value: string) {
    return (
      value
        .trim()
        .replace(/^-+|-+$/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase() || 'SIN CLASIFICAR'
    );
  }
  private async owned(s: Session, id: string) {
    const p = await this.db.product.findFirst({ where: { id, companyId: s.companyId, deletedAt: null } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }
  private percentage(oldValue: Prisma.Decimal, newValue: Prisma.Decimal) {
    return oldValue.eq(0) ? new Prisma.Decimal(0) : newValue.minus(oldValue).div(oldValue).mul(100).toDecimalPlaces(2);
  }
  private json(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
  private async validateRefs(s: Session, categoryId: string, brandId?: string, subcategoryId?: string) {
    const [c, b, subcategory] = await Promise.all([
      this.db.category.findFirst({ where: { id: categoryId, companyId: s.companyId, deletedAt: null } }),
      brandId ? this.db.brand.findFirst({ where: { id: brandId, companyId: s.companyId, deletedAt: null } }) : true,
      subcategoryId
        ? this.db.category.findFirst({
            where: { id: subcategoryId, companyId: s.companyId, parentId: categoryId, deletedAt: null },
          })
        : true,
    ]);
    if (!c || !b || !subcategory) throw new BadRequestException('Categoría, subcategoría o marca inválida');
  }
  private async ensureBarcodeAvailable(s: Session, barcode: string, productId?: string) {
    if (!/^\d+$/.test(barcode)) throw new BadRequestException('El código de bulto debe ser numérico');
    const conflict = await this.db.productBarcode.findFirst({
      where: { companyId: s.companyId, barcode, ...(productId ? { productId: { not: productId } } : {}) },
    });
    if (conflict) throw new BadRequestException('El código de barras ya pertenece a otro producto');
  }
}
class FamilyDto {
  @IsString() @Length(2, 100) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
@Controller('product-families')
class ProductFamiliesController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('products.view') list(@CurrentSession() s: Session) {
    return this.db.productFamily.findMany({
      where: { companyId: s.companyId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }
  @Post() @RequirePermissions('products.update') create(@CurrentSession() s: Session, @Body() d: FamilyDto) {
    return this.db.productFamily.create({ data: { companyId: s.companyId, ...d } });
  }
  @Patch(':id') @RequirePermissions('products.update') async update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: FamilyDto,
  ) {
    const found = await this.db.productFamily.findFirst({ where: { id, companyId: s.companyId } });
    if (!found) throw new NotFoundException('Familia no encontrada');
    return this.db.productFamily.update({ where: { id }, data: d });
  }
}
@Module({ controllers: [ProductsController, ProductFamiliesController] })
export class ProductsModule {}
