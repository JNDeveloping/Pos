import { BadRequestException } from '@nestjs/common';
import type { Session } from '../../common/auth';
import { CashSessionsController } from './sales.module';

const base: Session = { sub: 'cashier', companyId: 'company', branchId: null, roles: [], permissions: ['sales.access'], tokenVersion: 0 };

describe('apertura rápida de caja', () => {
  it('no permite que un cajero abra una sesión a nombre de otro usuario', async () => {
    const db = { branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', name: 'Principal' }) } };
    const controller = new CashSessionsController(db as never);
    await expect(controller.open(base, { branchId: 'branch', cashierUserId: 'other', openingAmount: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('devuelve terminales y cajeros de la empresa/sucursal', async () => {
    const db = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', name: 'Principal' }) },
      terminal: { findMany: jest.fn().mockResolvedValue([{ id: 'terminal' }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'cashier' }]) },
    };
    const controller = new CashSessionsController(db as never);
    await expect(controller.bootstrap(base, 'branch')).resolves.toEqual({ branch: { id: 'branch', name: 'Principal' }, terminals: [{ id: 'terminal' }], cashiers: [{ id: 'cashier' }] });
  });
});
