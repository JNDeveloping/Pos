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
    const where = { companyId: s.companyId, deletedAt: null };
    const [products, activeProducts, branches, users, categories, withoutPrice, configured, enabledInBranch] =
      await this.db.$transaction([
        this.db.product.count({ where }),
        this.db.product.count({ where: { ...where, active: true } }),
        this.db.branch.count({ where: { ...where, active: true } }),
        this.db.user.count({ where: { ...where, active: true } }),
        this.db.category.count({ where: { ...where, active: true } }),
        this.db.product.count({ where: { ...where, branchConfigs: { some: { salePrice: 0 } } } }),
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
      productsWithoutBranchConfig: configured,
      enabledInBranch,
    };
  }
}
@Module({ controllers: [C] })
export class DashboardModule {}
