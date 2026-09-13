import { BadRequestException } from '@nestjs/common';
import type { Session } from '../../common/auth';
import { argentinaDayStart, DashboardController } from './dashboard.module';

describe('panel del dueño por sucursal', () => {
  const session: Session = { sub: 'owner', companyId: 'company', branchId: null, roles: ['ADMIN'], permissions: ['dashboard.view'], tokenVersion: 0 };
  it('rechaza consultar métricas de una sucursal no habilitada', async () => {
    const db = { branch: { findMany: jest.fn().mockResolvedValue([{ id: 'allowed', name: 'Centro', code: 'CEN' }]) } };
    const controller = new DashboardController(db as never);
    await expect(controller.summary(session, 'forbidden', '7')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('arma el monitor en vivo sólo con sucursales accesibles', async () => {
    const db = {
      branch: { findMany: jest.fn().mockResolvedValue([{ id: 'allowed', name: 'Centro', code: 'CEN' }]) },
      sale: { groupBy: jest.fn().mockResolvedValue([{ branchId: 'allowed', _sum: { total: 1500 }, _count: 2 }]), findFirst: jest.fn().mockResolvedValue({ completedAt: new Date(), total: 800, saleNumber: 'V-2' }) },
      cashSession: { groupBy: jest.fn().mockResolvedValue([{ branchId: 'allowed', _count: 1 }]) },
      stock: { findMany: jest.fn().mockResolvedValue([]) },
      branchProduct: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const controller = new DashboardController(db as never);
    await expect(controller.live(session)).resolves.toMatchObject({ branches: [{ id: 'allowed', salesToday: 1500, ticketsToday: 2, openCash: 1 }] });
    expect(db.branch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'company', OR: expect.any(Array) }) }));
  });
});

describe('día comercial argentino', () => {
  it('corta el día a medianoche de Buenos Aires aunque el servidor esté en UTC', () => {
    expect(argentinaDayStart(new Date('2026-09-05T02:30:00.000Z')).toISOString()).toBe('2026-09-04T03:00:00.000Z');
    expect(argentinaDayStart(new Date('2026-09-05T14:00:00.000Z')).toISOString()).toBe('2026-09-05T03:00:00.000Z');
  });
});
