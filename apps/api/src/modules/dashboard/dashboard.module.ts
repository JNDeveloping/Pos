import { Controller, Get, Module, Query } from '@nestjs/common';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
@Controller('dashboard')
class C {
  constructor(private db: PrismaService) {}
  @Get('summary') @RequirePermissions('dashboard.view') async summary(
    @CurrentSession() s: Session,
    @Query('branchId') branchId?: string,
  ) {
    if (s.branchId && branchId && s.branchId !== branchId) branchId = s.branchId;
    if (s.branchId) branchId = s.branchId;
    const where = { companyId: s.companyId, deletedAt: null };
    const [products, activeProducts, branches, users, categories, withoutPrice, withoutCost, withoutBarcode, lowMargin, pricesChangedToday, configured, enabledInBranch] =
      await this.db.$transaction([
        this.db.product.count({ where }),
        this.db.product.count({ where: { ...where, active: true } }),
        this.db.branch.count({ where: { ...where, active: true } }),
        this.db.user.count({ where: { ...where, active: true } }),
        this.db.category.count({ where: { ...where, active: true } }),
        this.db.product.count({ where: { ...where, branchConfigs: { some: { salePrice: 0 } } } }),
        this.db.product.count({ where: { ...where, branchConfigs: { some: { cost: 0 } } } }),
        this.db.product.count({ where: { ...where, barcodes: { none: {} } } }),
        this.db.branchProduct.count({ where: { ...(branchId ? { branchId } : {}), enabled: true, margin: { lt: 10 }, branch: { companyId: s.companyId } } }),
        this.db.priceHistory.count({ where: { branch: { companyId: s.companyId }, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        this.db.product.count({ where: { ...where, branchConfigs: { none: {} } } }),
        branchId
          ? this.db.branchProduct.count({
              where: {
                branchId,
                enabled: true,
                product: { companyId: s.companyId, active: true, deletedAt: null },
              },
            })
          : this.db.branchProduct.count({ where: { enabled: true, branch: { companyId: s.companyId } } }),
      ]);
    return {
      products,
      activeProducts,
      activeBranches: branches,
      activeUsers: users,
      categories,
      productsWithoutPrice: withoutPrice,
      productsWithoutCost: withoutCost,
      productsWithoutBarcode: withoutBarcode,
      lowMargin,
      pricesChangedToday,
      productsWithoutBranchConfig: configured,
      enabledInBranch,
    };
  }
}
@Module({ controllers: [C] })
export class DashboardModule {}
