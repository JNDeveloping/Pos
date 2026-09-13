import { Prisma } from '@prisma/client';
import type { Session } from '../../common/auth';
import { SalesService } from './sales.module';

describe('idempotencia de venta', () => {
  it('devuelve la venta ya confirmada si dos requests compiten por operationId', async () => {
    const completed = { id: 'sale', companyId: 'company', operationId: 'operation', items: [], payments: [] };
    const unique = new Prisma.PrismaClientKnownRequestError('operationId duplicado', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['operationId'] },
    });
    const db = {
      sale: { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(completed) },
      $transaction: jest.fn().mockRejectedValue(unique),
    };
    const session: Session = {
      sub: 'cashier', companyId: 'company', branchId: null, roles: [], permissions: [], tokenVersion: 0,
    };
    const service = new SalesService(db as never, {} as never, {} as never);
    await expect(service.create(session, {
      operationId: 'operation', branchId: 'branch', terminalId: 'terminal', items: [{}], payments: [],
    } as never)).resolves.toEqual(completed);
    expect(db.sale.findUnique).toHaveBeenCalledTimes(2);
  });
});
