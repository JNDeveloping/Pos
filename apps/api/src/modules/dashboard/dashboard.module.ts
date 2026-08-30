import { Controller, Get, Module, Query } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
@Controller('dashboard')
class DashboardController {
  constructor(private db: PrismaService) {}
  @Get('summary') @RequirePermissions('dashboard.view') async summary(
    @CurrentSession() s: Session,
    @Query('branchId') requested?: string,
    @Query('days') requestedDays?: string,
  ) {
    const branchId = s.branchId ?? requested,
      days = requestedDays === '30' ? 30 : 7,
      now = new Date(),
      today = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      yesterday = new Date(today.getTime() - 86400000),
      month = new Date(now.getFullYear(), now.getMonth(), 1),
      periodStart = new Date(today.getTime() - (days - 1) * 86400000);
    const saleWhere = {
      companyId: s.companyId,
      status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] },
      ...(branchId ? { branchId } : {}),
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
          ...(branchId ? { branchId } : {}),
          enabled: true,
          stockMinimum: { gt: 0 },
        },
        select: { branchId: true, productId: true, stockMinimum: true },
      }),
      this.db.stock.findMany({
        where: { companyId: s.companyId, ...(branchId ? { branchId } : {}) },
        select: { branchId: true, productId: true, quantity: true, reservedQuantity: true },
      }),
      this.db.stockLot.count({
        where: {
          companyId: s.companyId,
          ...(branchId ? { branchId } : {}),
          quantity: { gt: 0 },
          expirationDate: { gte: today, lte: new Date(today.getTime() + 30 * 86400000) },
        },
      }),
      this.db.branchProduct.count({
        where: {
          branch: { companyId: s.companyId },
          ...(branchId ? { branchId } : {}),
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
        where: { sale: { ...saleWhere, completedAt: { gte: month } } },
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
    ]);
    const methodIds = paymentGroups.map((x) => x.paymentMethodId),
      methods = await this.db.paymentMethod.findMany({
        where: { id: { in: methodIds } },
        select: { id: true, name: true },
      }),
      daily = Array.from({ length: days }, (_, i) => {
        const date = new Date(periodStart.getTime() + i * 86400000),
          key = date.toISOString().slice(0, 10);
        return {
          date: key,
          total: sevenDays
            .filter((x) => x.completedAt?.toISOString().slice(0, 10) === key)
            .reduce((n, x) => n + Number(x.total), 0),
        };
      }),
      hourly = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        total: sevenDays
          .filter((sale) => sale.completedAt?.getHours() === hour)
          .reduce((total, sale) => total + Number(sale.total), 0),
        tickets: sevenDays.filter((sale) => sale.completedAt?.getHours() === hour).length,
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
}
@Module({ controllers: [DashboardController] })
export class DashboardModule {}
