import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { Session } from './auth.service';
import { ProductDto } from './catalog.controller';

@Injectable()
export class CatalogService {
  constructor(private readonly db: PrismaService) {}
  categories(session: Session) { return this.db.category.findMany({ where: { companyId: session.companyId, deletedAt: null }, orderBy: { name: 'asc' } }); }
  products(session: Session, search?: string) {
    return this.db.product.findMany({ where: { companyId: session.companyId, deletedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { internalCode: { contains: search, mode: 'insensitive' } }, { barcodes: { some: { code: search } } }] } : {}) }, include: { category: true, brand: true, barcodes: true, branches: { include: { branch: { select: { name: true } } } } }, orderBy: { name: 'asc' } });
  }
  async createProduct(session: Session, dto: ProductDto) {
    const category = await this.db.category.findFirst({ where: { id: dto.categoryId, companyId: session.companyId, deletedAt: null } });
    if (!category) throw new BadRequestException('Categoría inválida');
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { companyId: session.companyId, categoryId: dto.categoryId, internalCode: dto.internalCode, name: dto.name, unit: dto.unit as Unit, cost: new Prisma.Decimal(dto.cost), generalPrice: new Prisma.Decimal(dto.generalPrice), barcodes: { create: dto.barcode ? [{ code: dto.barcode, primary: true }] : [] } } });
      const branches = await tx.branch.findMany({ where: { companyId: session.companyId, active: true, deletedAt: null }, select: { id: true } });
      await tx.branchProduct.createMany({ data: branches.map((branch) => ({ branchId: branch.id, productId: product.id })) });
      return product;
    });
  }
  async updateBranch(session: Session, productId: string, branchId: string, price?: string, minimumStock?: string) {
    const branch = await this.db.branch.findFirst({ where: { id: branchId, companyId: session.companyId, ...(session.branchId ? { id: session.branchId } : {}) } });
    const product = await this.db.product.findFirst({ where: { id: productId, companyId: session.companyId } });
    if (!branch || !product) throw new NotFoundException('Producto o sucursal inexistente');
    return this.db.branchProduct.upsert({ where: { branchId_productId: { branchId, productId } }, create: { branchId, productId, price: price ? new Prisma.Decimal(price) : null, minimumStock: new Prisma.Decimal(minimumStock ?? 0) }, update: { price: price ? new Prisma.Decimal(price) : null, minimumStock: minimumStock ? new Prisma.Decimal(minimumStock) : undefined, version: { increment: 1 } } });
  }
}
