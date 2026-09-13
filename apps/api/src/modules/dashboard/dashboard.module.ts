import { BadRequestException, Controller, Get, Module, Query } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;
export function argentinaDayStart(now = new Date()) {
  const local = new Date(now.getTime() - ARGENTINA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3));
}
const argentinaDateKey = (date: Date) => new Date(date.getTime() - ARGENTINA_OFFSET_MS).toISOString().slice(0, 10);
const argentinaHour = (date: Date) => (date.getUTCHours() + 21) % 24;
@Controller('dashboard')
export class DashboardController {
  constructor(private db: PrismaService) {}
  private branches(s: Session) {
    return this.db.branch.findMany({
      where: {
        companyId: s.companyId,
        active: true,
        deletedAt: null,
        ...(s.roles.includes('SUPER_ADMIN')
          ? {}
          : { OR: [{ users: { some: { id: s.sub } } }, { userAccesses: { some: { userId: s.sub } } }] }),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }
  @Get('summary') @RequirePermissions('dashboard.view') async summary(
    @CurrentSession() s: Session,
    @Query('branchId') requested?: string,
    @Query('days') requestedDays?: string,
  ) {
    const availableBranches = await this.branches(s),
      requestedBranchId = s.branchId ?? requested;
    if (requestedBranchId && !availableBranches.some((branch) => branch.id === requestedBranchId))
      throw new BadRequestException('Sucursal fuera del alcance del usuario');
    const branchIds = requestedBranchId ? [requestedBranchId] : availableBranches.map((branch) => branch.id),
      days = requestedDays === '30' ? 30 : 7,
      now = new Date(),
      today = argentinaDayStart(now),
      yesterday = new Date(today.getTime() - 86400000),
      month = new Date(Date.UTC(new Date(now.getTime() - ARGENTINA_OFFSET_MS).getUTCFullYear(), new Date(now.getTime() - ARGENTINA_OFFSET_MS).getUTCMonth(), 1, 3)),
      periodStart = new Date(today.getTime() - (days - 1) * 86400000);
    const saleWhere = {
      companyId: s.companyId,
      status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] },
      branchId: { in: branchIds },
    };
    const [
      todaySales,
      yesterdaySales,
      monthSales,
      lowConfigs,
      stocksForLow,
      expiring,
      lowMargin,
      topProducts,
      recentSales,
      sevenDays,
      paymentGroups,
      todayItems,
      monthItems,
      openSessions,
      incompleteProducts,
      salesByBranch,
    ] = await Promise.all([
      this.db.sale.aggregate({
        where: { ...saleWhere, completedAt: { gte: today } },
        _sum: { total: true, costTotal: true },
        _count: true,
      }),
      this.db.sale.aggregate({
        where: { ...saleWhere, completedAt: { gte: yesterday, lt: today } },
        _sum: { total: true },
        _count: true,
      }),
      this.db.sale.aggregate({
        where: { ...saleWhere, completedAt: { gte: month } },
        _sum: { total: true, costTotal: true },
        _count: true,
      }),
      this.db.branchProduct.findMany({
        where: {
          branch: { companyId: s.companyId },
          branchId: { in: branchIds },
          enabled: true,
          stockMinimum: { gt: 0 },
        },
        select: { branchId: true, productId: true, stockMinimum: true },
      }),
      this.db.stock.findMany({
        where: { companyId: s.companyId, branchId: { in: branchIds } },
        select: { branchId: true, productId: true, quantity: true, reservedQuantity: true },
      }),
      this.db.stockLot.count({
        where: {
          companyId: s.companyId,
          branchId: { in: branchIds },
          quantity: { gt: 0 },
          expirationDate: { gte: today, lte: new Date(today.getTime() + 30 * 86400000) },
        },
      }),
      this.db.branchProduct.count({
        where: {
          branch: { companyId: s.companyId },
          branchId: { in: branchIds },
          enabled: true,
          margin: { lt: 10 },
        },
      }),
      this.db.saleItem.groupBy({
        by: ['productId', 'productNameSnapshot'],
        where: { sale: { ...saleWhere, completedAt: { gte: month } } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.db.sale.findMany({
        where: saleWhere,
        include: { payments: { include: { paymentMethod: true } } },
        orderBy: { completedAt: 'desc' },
        take: 6,
      }),
      this.db.sale.findMany({
        where: { ...saleWhere, completedAt: { gte: periodStart } },
        select: { completedAt: true, total: true },
      }),
      this.db.payment.groupBy({
        by: ['paymentMethodId'],
        where: { sale: { ...saleWhere, completedAt: { gte: today } } },
        _sum: { amount: true },
      }),
      this.db.saleItem.aggregate({
        where: { sale: { ...saleWhere, completedAt: { gte: today } } },
        _sum: { quantity: true },
      }),
      this.db.saleItem.aggregate({
        where: { sale: { ...saleWhere, completedAt: { gte: month } } },
        _sum: { quantity: true },
      }),
      this.db.cashSession.findMany({
        where: { companyId: s.companyId, branchId: { in: branchIds }, status: 'OPEN' },
        select: {
          id: true,
          branchId: true,
          openingAmount: true,
          terminal: { select: { name: true } },
          cashier: { select: { firstName: true, lastName: true } },
          movements: { select: { kind: true, amount: true } },
          sales: { where: { status: SaleStatus.COMPLETED }, select: { payments: { select: { cashImpact: true } } } },
        },
      }),
      this.db.branchProduct.count({
        where: { branchId: { in: branchIds }, enabled: true, OR: [{ salePrice: 0 }, { cost: 0 }] },
      }),
      this.db.sale.groupBy({
        by: ['branchId'],
        where: { ...saleWhere, completedAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
    ]);
    const methodIds = paymentGroups.map((x) => x.paymentMethodId),
      methods = await this.db.paymentMethod.findMany({
        where: { id: { in: methodIds } },
        select: { id: true, name: true },
      }),
      daily = Array.from({ length: days }, (_, i) => {
        const date = new Date(periodStart.getTime() + i * 86400000),
          key = argentinaDateKey(date);
        return {
          date: key,
          total: sevenDays
            .filter((x) => x.completedAt && argentinaDateKey(x.completedAt) === key)
            .reduce((n, x) => n + Number(x.total), 0),
        };
      }),
      hourly = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        total: sevenDays
          .filter((sale) => sale.completedAt && argentinaHour(sale.completedAt) === hour)
          .reduce((total, sale) => total + Number(sale.total), 0),
        tickets: sevenDays.filter((sale) => sale.completedAt && argentinaHour(sale.completedAt) === hour).length,
      }));
    const stockMap = new Map(
      stocksForLow.map((row) => [
        `${row.branchId}:${row.productId}`,
        Number(row.quantity) - Number(row.reservedQuantity),
      ]),
    );
    const lowStock = lowConfigs.filter((row) => {
      const available = stockMap.get(`${row.branchId}:${row.productId}`) ?? 0;
      return available > 0 && available <= Number(row.stockMinimum);
    }).length;
    const outOfStock = lowConfigs.filter((row) => (stockMap.get(`${row.branchId}:${row.productId}`) ?? 0) <= 0).length;
    const todayTotal = Number(todaySales._sum.total ?? 0),
      yesterdayTotal = Number(yesterdaySales._sum.total ?? 0),
      monthTotal = Number(monthSales._sum.total ?? 0);
    const openCash = openSessions.map((cash) => {
      const salesCash = cash.sales.reduce(
        (total, sale) => total + sale.payments.reduce((subtotal, payment) => subtotal + Number(payment.cashImpact), 0),
        0,
      );
      const movements = cash.movements.reduce(
        (total, movement) => total + (movement.kind === 'INCOME' ? Number(movement.amount) : -Number(movement.amount)),
        0,
      );
      return { id: cash.id, branchId: cash.branchId, terminal: cash.terminal.name, cashier: `${cash.cashier.firstName} ${cash.cashier.lastName}`, expectedCash: Number(cash.openingAmount) + salesCash + movements };
    });
    return {
      todaySales: todayTotal,
      yesterdaySales: yesterdayTotal,
      comparison: yesterdayTotal ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : null,
      monthSales: monthTotal,
      ticketsToday: todaySales._count,
      averageTicket: todaySales._count ? todayTotal / todaySales._count : 0,
      estimatedProfit: monthTotal - Number(monthSales._sum.costTotal ?? 0),
      grossMargin: monthTotal
        ? ((monthTotal - Number(monthSales._sum.costTotal ?? 0)) / monthTotal) * 100
        : 0,
      productsToday: Number(todayItems._sum.quantity ?? 0),
      productsMonth: Number(monthItems._sum.quantity ?? 0),
      lowStock,
      outOfStock,
      expiring,
      lowMargin,
      incompleteProducts,
      openCash,
      openCashCount: openCash.length,
      expectedCash: openCash.reduce((total, cash) => total + cash.expectedCash, 0),
      branches: availableBranches.map((branch) => {
        const sales = salesByBranch.find((row) => row.branchId === branch.id);
        const branchLow = lowConfigs.filter((row) => row.branchId === branch.id && (stockMap.get(`${row.branchId}:${row.productId}`) ?? 0) <= Number(row.stockMinimum)).length;
        return { ...branch, salesToday: Number(sales?._sum.total ?? 0), ticketsToday: sales?._count ?? 0, openCash: openCash.filter((cash) => cash.branchId === branch.id).length, alerts: branchLow };
      }),
      topProducts,
      recentSales,
      daily,
      hourly,
      periodDays: days,
      paymentMethods: paymentGroups.map((x) => ({
        name: methods.find((m) => m.id === x.paymentMethodId)?.name ?? 'Otro',
        total: Number(x._sum.amount ?? 0),
      })),
    };
  }
  @Get('live') @RequirePermissions('dashboard.view') async live(@CurrentSession() s: Session) {
    const branches = await this.branches(s),
      branchIds = branches.map((branch) => branch.id),
      now = new Date(),
      today = argentinaDayStart(now);
    const [sales, openCash, stocks, configs, lastSales] = await Promise.all([
      this.db.sale.groupBy({
        by: ['branchId'],
        where: { companyId: s.companyId, branchId: { in: branchIds }, status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] }, completedAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      this.db.cashSession.groupBy({ by: ['branchId'], where: { companyId: s.companyId, branchId: { in: branchIds }, status: 'OPEN' }, _count: true }),
      this.db.stock.findMany({ where: { companyId: s.companyId, branchId: { in: branchIds } }, select: { branchId: true, productId: true, quantity: true, reservedQuantity: true } }),
      this.db.branchProduct.findMany({ where: { branchId: { in: branchIds }, enabled: true, stockMinimum: { gt: 0 } }, select: { branchId: true, productId: true, stockMinimum: true } }),
      Promise.all(branchIds.map((branchId) => this.db.sale.findFirst({ where: { companyId: s.companyId, branchId, status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] } }, select: { completedAt: true, total: true, saleNumber: true }, orderBy: { completedAt: 'desc' } }))),
    ]);
    const stock = new Map(stocks.map((row) => [`${row.branchId}:${row.productId}`, Number(row.quantity) - Number(row.reservedQuantity)]));
    return {
      generatedAt: now,
      branches: branches.map((branch, index) => {
        const branchSales = sales.find((row) => row.branchId === branch.id),
          relevant = configs.filter((row) => row.branchId === branch.id),
          outOfStock = relevant.filter((row) => (stock.get(`${row.branchId}:${row.productId}`) ?? 0) <= 0).length,
          lowStock = relevant.filter((row) => { const current = stock.get(`${row.branchId}:${row.productId}`) ?? 0; return current > 0 && current <= Number(row.stockMinimum); }).length;
        return { ...branch, salesToday: Number(branchSales?._sum.total ?? 0), ticketsToday: branchSales?._count ?? 0, openCash: openCash.find((row) => row.branchId === branch.id)?._count ?? 0, lowStock, outOfStock, lastSale: lastSales[index] };
      }),
    };
  }
}
@Module({ controllers: [DashboardController] })
export class DashboardModule {}
