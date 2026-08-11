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
} from '@nestjs/common';
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
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class ProductDto {
  @IsOptional() @IsString() @Length(2, 50) internalCode?: string;
  @IsString() @Length(2, 180) name!: string;
  @IsOptional() @IsString() @Length(1, 80) shortName?: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() subcategoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
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
}
class ProductPatchDto {
  @IsOptional() @IsString() @Length(2, 50) internalCode?: string;
  @IsOptional() @IsString() @Length(2, 180) name?: string;
  @IsOptional() @IsString() @Length(1, 80) shortName?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() subcategoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
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
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() withoutPrice?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() withoutCost?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() withoutBarcode?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() posFavorite?: boolean;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() enabled?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() active?: boolean;
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
class ProductsController {
  constructor(private db: PrismaService) {}
  private include = {
    category: true,
    subcategory: true,
    brand: true,
    barcodes: true,
    branchConfigs: { include: { branch: true } },
    _count: { select: { branchConfigs: { where: { enabled: true } } } },
  } as const;
  @Get() @RequirePermissions('products.view') async list(@CurrentSession() s: Session, @Query() q: ListQuery) {
    if (s.branchId && q.branchId && s.branchId !== q.branchId) throw new ForbiddenException('Sucursal fuera de su alcance');
    const branchId = s.branchId ?? q.branchId;
    const branchConditions: Prisma.ProductWhereInput[] = [];
    if (q.withoutPrice) branchConditions.push({ branchConfigs: { some: { ...(branchId ? { branchId } : {}), salePrice: 0 } } });
    if (q.withoutCost) branchConditions.push({ branchConfigs: { some: { ...(branchId ? { branchId } : {}), cost: 0 } } });
    if (q.posFavorite) branchConditions.push({ branchConfigs: { some: { ...(branchId ? { branchId } : {}), posFavorite: true } } });
    if (branchId) branchConditions.push({ branchConfigs: q.enabled === false ? { none: { branchId, enabled: true } } : { some: { branchId, ...(q.enabled === true ? { enabled: true } : {}) } } });
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
    const canViewCosts = s.permissions.includes('costs.view');
    const safeData = canViewCosts
      ? data
      : data.map((product) => ({
          ...product,
          branchConfigs: product.branchConfigs.map(({ cost: _cost, ...config }) => config),
        }));
    return { data: safeData, meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
  }
  @Get(':id') @RequirePermissions('products.view') async one(@CurrentSession() s: Session, @Param('id') id: string) {
    const p = await this.db.product.findFirst({
      where: { id, companyId: s.companyId, deletedAt: null },
      include: this.include,
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (s.permissions.includes('costs.view')) return p;
    return { ...p, branchConfigs: p.branchConfigs.map(({ cost: _cost, ...config }) => config) };
  }
  @Post() @RequirePermissions('products.create') async create(@CurrentSession() s: Session, @Body() d: ProductDto) {
    await this.validateRefs(s, d.categoryId, d.brandId, d.subcategoryId);
    if (d.caseBarcode) await this.ensureBarcodeAvailable(s, d.caseBarcode);
    return this.db.$transaction(async (tx) => {
      const sequence = d.internalCode
        ? undefined
        : await tx.company.update({ where: { id: s.companyId }, data: { productSequence: { increment: 1 } }, select: { productSequence: true } });
      const product = await tx.product.create({
        data: {
          ...d,
          internalCode: d.internalCode?.toUpperCase() ?? `PROD-${String(sequence!.productSequence).padStart(6, '0')}`,
          taxRate: new Prisma.Decimal(d.taxRate),
          companyId: s.companyId,
        },
      });
      if (d.caseBarcode) await tx.productBarcode.create({ data: { companyId: s.companyId, productId: product.id, barcode: d.caseBarcode, type: BarcodeType.CASE } });
      await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: product.id, action: 'PRODUCT_CREATED', after: this.json(product) } });
      return product;
    });
  }
  @Get('export/data') @RequirePermissions('products.export') async exportData(@CurrentSession() s: Session, @Query('branchId') branchId?: string) {
    return this.db.product.findMany({ where: { companyId: s.companyId, deletedAt: null }, select: { internalCode: true, name: true, shortName: true, sku: true, presentationType: true, netContent: true, netContentUnit: true, taxRate: true, category: { select: { name: true } }, subcategory: { select: { name: true } }, brand: { select: { name: true } }, barcodes: { orderBy: { isPrimary: 'desc' }, take: 1, select: { barcode: true } }, branchConfigs: { where: branchId ? { branchId } : undefined, select: { cost: s.permissions.includes('costs.view'), salePrice: true, margin: true, location: true } } }, take: 50000, orderBy: { name: 'asc' } });
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
            subcategory = await tx.category.findFirst({ where: { companyId: s.companyId, parentId: category.id, name: { equals: row.subcategoria.trim(), mode: 'insensitive' }, deletedAt: null } });
            if (!subcategory) subcategory = await tx.category.create({ data: { companyId: s.companyId, parentId: category.id, name: row.subcategoria.trim() } });
          }
          let brand;
          if (row.marca) {
            brand = await tx.brand.findFirst({ where: { companyId: s.companyId, name: { equals: row.marca.trim(), mode: 'insensitive' }, deletedAt: null } });
            if (!brand) { brand = await tx.brand.create({ data: { companyId: s.companyId, name: row.marca.trim() } }); result.brandsCreated++; }
          }
          const barcodeRecord = await tx.productBarcode.findUnique({
            where: { companyId_barcode: { companyId: s.companyId, barcode } },
            include: { product: true },
          });
          let product;
          if (barcodeRecord) {
            product = await tx.product.update({
              where: { id: barcodeRecord.productId },
              data: { name: row.descripcion.trim(), categoryId: category.id, subcategoryId: subcategory?.id, brandId: brand?.id, presentationType: row.presentacion, netContent: row.contenido, netContentUnit: row.unidad, unitsPerCase: row.unidadesPorBulto, caseBarcode: row.barcodeBulto, taxRate: row.iva, sku: row.sku, active: true, deletedAt: null },
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
                barcodes: { create: [{ companyId: s.companyId, barcode, isPrimary: true, type: barcode.length === 13 ? BarcodeType.EAN13 : BarcodeType.OTHER }, ...(row.barcodeBulto && row.barcodeBulto !== barcode ? [{ companyId: s.companyId, barcode: row.barcodeBulto, isPrimary: false, type: BarcodeType.CASE }] : [])] },
              },
            });
            result.created++;
          }
          if (d.enableForBranch && d.branchId)
            await tx.branchProduct.upsert({
              where: { branchId_productId: { branchId: d.branchId, productId: product.id } },
              create: { branchId: d.branchId, productId: product.id, enabled: true, cost: row.costo ?? 0, salePrice: row.precio ?? 0, margin: row.costo && row.precio && Number(row.costo) > 0 ? ((Number(row.precio) - Number(row.costo)) / Number(row.costo)) * 100 : 0, location: row.ubicacion },
              update: { enabled: true, ...(row.costo ? { cost: row.costo } : {}), ...(row.precio ? { salePrice: row.precio } : {}), ...(row.ubicacion ? { location: row.ubicacion } : {}) },
            });
          await tx.auditLog.create({ data: { companyId: s.companyId, branchId: d.branchId, userId: s.sub, entityType: 'PRODUCT', entityId: product.id, action: 'IMPORT_EXECUTED', metadata: { barcode } } });
        });
      } catch (error) {
        result.skipped++;
        result.errors.push(`${barcode}: ${error instanceof Error ? error.message : 'error de importación'}`);
      }
    }
    return result;
  }
  @Post(':id/duplicate') @RequirePermissions('products.create') async duplicate(@CurrentSession() s: Session, @Param('id') id: string, @Body() body: { name?: string; copyBranchConfig?: boolean }) {
    const source = await this.db.product.findFirst({ where: { id, companyId: s.companyId, deletedAt: null }, include: { branchConfigs: true } });
    if (!source) throw new NotFoundException('Producto no encontrado');
    return this.db.$transaction(async (tx) => {
      const company = await tx.company.update({ where: { id: s.companyId }, data: { productSequence: { increment: 1 } }, select: { productSequence: true } });
      const { branchConfigs } = source;
      const product = await tx.product.create({ data: {
        companyId: s.companyId, internalCode: `PROD-${String(company.productSequence).padStart(6, '0')}`,
        name: body.name?.trim() || `${source.name} (copia)`, shortName: source.shortName, description: source.description,
        categoryId: source.categoryId, subcategoryId: source.subcategoryId, brandId: source.brandId, unitType: source.unitType,
        presentationType: source.presentationType, netContent: source.netContent, netContentUnit: source.netContentUnit,
        taxRate: source.taxRate, imageUrl: source.imageUrl, sku: source.sku, supplierReference: source.supplierReference,
        unitsPerCase: source.unitsPerCase, caseBarcode: source.caseBarcode, isWeighted: source.isWeighted,
        allowManualPriceDefault: source.allowManualPriceDefault, notes: source.notes, active: true,
      } });
      if (body.copyBranchConfig) await tx.branchProduct.createMany({ data: branchConfigs.map(({ id: _configId, productId: _productId, createdAt: _cc, updatedAt: _cu, ...config }) => ({ ...config, productId: product.id })) });
      await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: product.id, action: 'PRODUCT_CREATED', metadata: { duplicatedFrom: id } } });
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
      const product = await tx.product.update({ where: { id }, data: { ...d, internalCode: d.internalCode?.toUpperCase(), taxRate: d.taxRate ? new Prisma.Decimal(d.taxRate) : undefined } });
      if (d.caseBarcode !== undefined && d.caseBarcode !== before.caseBarcode) {
        await tx.productBarcode.deleteMany({ where: { productId: id, type: BarcodeType.CASE } });
        if (d.caseBarcode) await tx.productBarcode.create({ data: { companyId: s.companyId, productId: id, barcode: d.caseBarcode, type: BarcodeType.CASE } });
      }
      await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: id, action: 'PRODUCT_UPDATED', before: this.json(before), after: this.json(product) } });
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
      await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: id, action: 'PRODUCT_DISABLED', after: this.json(product) } });
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
    return this.db.$transaction(async (tx) => {
      if (d.isPrimary) await tx.productBarcode.updateMany({ where: { productId: id }, data: { isPrimary: false } });
      const barcode = await tx.productBarcode.create({ data: { ...d, companyId: s.companyId, productId: id } });
      await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: id, action: 'BARCODE_ADDED', after: this.json(barcode) } });
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
      await tx.auditLog.create({ data: { companyId: s.companyId, userId: s.sub, entityType: 'PRODUCT', entityId: id, action: 'BARCODE_REMOVED', before: this.json(barcode) } });
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
    return s.permissions.includes('costs.view') ? configs : configs.map(({ cost: _cost, ...config }) => config);
  }
  @Patch(':id/branches/:branchId') @RequirePermissions('products.update') async branch(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() d: ConfigDto,
  ) {
    if (d.cost !== undefined && !s.permissions.includes('costs.update')) throw new ForbiddenException('No tiene permiso para modificar costos');
    if ((d.salePrice !== undefined || d.margin !== undefined) && !s.permissions.includes('prices.update')) throw new ForbiddenException('No tiene permiso para modificar precios');
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
          data: { productId: id, branchId, oldPrice: current.salePrice, newPrice: price, percentageChange: this.percentage(current.salePrice, price), source: d.source ?? ChangeSource.MANUAL, changedByUserId: s.sub },
        });
      if (current && !current.cost.equals(cost))
        await tx.costHistory.create({
          data: { productId: id, branchId, oldCost: current.cost, newCost: cost, percentageChange: this.percentage(current.cost, cost), source: d.source ?? ChangeSource.MANUAL, changedByUserId: s.sub },
        });
      await tx.auditLog.create({ data: { companyId: s.companyId, branchId, userId: s.sub, entityType: 'BRANCH_PRODUCT', entityId: config.id, action: current ? 'BRANCH_PRODUCT_UPDATED' : 'PRODUCT_ENABLED', before: current ? this.json(current) : undefined, after: this.json(config) } });
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
  private percentage(oldValue: Prisma.Decimal, newValue: Prisma.Decimal) { return oldValue.eq(0) ? new Prisma.Decimal(0) : newValue.minus(oldValue).div(oldValue).mul(100).toDecimalPlaces(2); }
  private json(value: unknown) { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
  private async validateRefs(s: Session, categoryId: string, brandId?: string, subcategoryId?: string) {
    const [c, b, subcategory] = await Promise.all([
      this.db.category.findFirst({ where: { id: categoryId, companyId: s.companyId, deletedAt: null } }),
      brandId ? this.db.brand.findFirst({ where: { id: brandId, companyId: s.companyId, deletedAt: null } }) : true,
      subcategoryId ? this.db.category.findFirst({ where: { id: subcategoryId, companyId: s.companyId, parentId: categoryId, deletedAt: null } }) : true,
    ]);
    if (!c || !b || !subcategory) throw new BadRequestException('Categoría, subcategoría o marca inválida');
  }
  private async ensureBarcodeAvailable(s: Session, barcode: string, productId?: string) {
    if (!/^\d+$/.test(barcode)) throw new BadRequestException('El código de bulto debe ser numérico');
    const conflict = await this.db.productBarcode.findFirst({ where: { companyId: s.companyId, barcode, ...(productId ? { productId: { not: productId } } : {}) } });
    if (conflict) throw new BadRequestException('El código de barras ya pertenece a otro producto');
  }
}
@Module({ controllers: [ProductsController] })
export class ProductsModule {}
