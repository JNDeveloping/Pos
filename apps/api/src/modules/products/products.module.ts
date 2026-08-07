import { ApiTags } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma, UnitType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class ProductDto {
  @IsString() @Length(2, 50) internalCode!: string;
  @IsString() @Length(2, 180) name!: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(UnitType) unitType: UnitType = UnitType.UNIT;
  @IsNumberString() taxRate = '21';
  @IsOptional() @IsString() imageUrl?: string;
}
class ProductPatchDto {
  @IsOptional() @IsString() @Length(2, 50) internalCode?: string;
  @IsOptional() @IsString() @Length(2, 180) name?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
  @IsOptional() @IsNumberString() taxRate?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class BarcodeDto {
  @IsString() @Length(4, 64) barcode!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
class ConfigDto {
  @IsOptional() @IsNumberString() cost?: string;
  @IsOptional() @IsNumberString() salePrice?: string;
  @IsOptional() @IsNumberString() margin?: string;
  @IsOptional() @IsNumberString() stockMinimum?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
class ListQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
@ApiTags('Productos')
@Controller('products')
class ProductsController {
  constructor(private db: PrismaService) {}
  private include = {
    category: true,
    brand: true,
    barcodes: true,
    branchConfigs: { include: { branch: true } },
  } as const;
  @Get() @RequirePermissions('products.view') async list(@CurrentSession() s: Session, @Query() q: ListQuery) {
    const where: Prisma.ProductWhereInput = {
      companyId: s.companyId,
      deletedAt: null,
      ...(q.active !== undefined ? { active: q.active } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(q.branchId ? { branchConfigs: { some: { branchId: q.branchId } } } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
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
    return { data, meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) } };
  }
  @Get(':id') @RequirePermissions('products.view') async one(@CurrentSession() s: Session, @Param('id') id: string) {
    const p = await this.db.product.findFirst({
      where: { id, companyId: s.companyId, deletedAt: null },
      include: this.include,
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }
  @Post() @RequirePermissions('products.create') async create(@CurrentSession() s: Session, @Body() d: ProductDto) {
    await this.validateRefs(s, d.categoryId, d.brandId);
    return this.db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: { ...d, taxRate: new Prisma.Decimal(d.taxRate), companyId: s.companyId },
      });
      const branches = await tx.branch.findMany({ where: { companyId: s.companyId, active: true, deletedAt: null } });
      await tx.branchProduct.createMany({ data: branches.map((b) => ({ branchId: b.id, productId: p.id })) });
      return p;
    });
  }
  @Patch(':id') @RequirePermissions('products.update') async update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: ProductPatchDto,
  ) {
    await this.owned(s, id);
    if (d.categoryId) await this.validateRefs(s, d.categoryId, d.brandId);
    return this.db.product.update({
      where: { id },
      data: { ...d, taxRate: d.taxRate ? new Prisma.Decimal(d.taxRate) : undefined },
    });
  }
  @Delete(':id') @RequirePermissions('products.delete') async remove(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    return this.db.product.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
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
      return tx.productBarcode.create({ data: { ...d, companyId: s.companyId, productId: id } });
    });
  }
  @Delete(':id/barcodes/:barcodeId') @RequirePermissions('products.update') async deleteBarcode(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('barcodeId') barcodeId: string,
  ) {
    await this.owned(s, id);
    return this.db.productBarcode.delete({ where: { id: barcodeId, productId: id } });
  }
  @Get(':id/branches') @RequirePermissions('products.view') async branches(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    await this.owned(s, id);
    return this.db.branchProduct.findMany({
      where: { productId: id },
      include: { branch: true },
      orderBy: { branch: { name: 'asc' } },
    });
  }
  @Patch(':id/branches/:branchId') @RequirePermissions('prices.update') async branch(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() d: ConfigDto,
  ) {
    await this.owned(s, id);
    const branch = await this.db.branch.findFirst({ where: { id: branchId, companyId: s.companyId, deletedAt: null } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
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
        },
        update: {
          cost,
          salePrice: price,
          margin,
          stockMinimum: d.stockMinimum !== undefined ? this.money(d.stockMinimum) : undefined,
          enabled: d.enabled,
        },
      });
      if (current && !current.salePrice.equals(price))
        await tx.priceHistory.create({
          data: { productId: id, branchId, oldPrice: current.salePrice, newPrice: price, changedByUserId: s.sub },
        });
      if (current && !current.cost.equals(cost))
        await tx.costHistory.create({
          data: { productId: id, branchId, oldCost: current.cost, newCost: cost, changedByUserId: s.sub },
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
  @Get(':id/cost-history') @RequirePermissions('prices.view') async costs(
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
  private async owned(s: Session, id: string) {
    const p = await this.db.product.findFirst({ where: { id, companyId: s.companyId, deletedAt: null } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }
  private async validateRefs(s: Session, categoryId: string, brandId?: string) {
    const [c, b] = await Promise.all([
      this.db.category.findFirst({ where: { id: categoryId, companyId: s.companyId, deletedAt: null } }),
      brandId ? this.db.brand.findFirst({ where: { id: brandId, companyId: s.companyId, deletedAt: null } }) : true,
    ]);
    if (!c || !b) throw new BadRequestException('Categoría o marca inválida');
  }
}
@Module({ controllers: [ProductsController] })
export class ProductsModule {}
