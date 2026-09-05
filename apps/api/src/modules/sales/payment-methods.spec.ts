import type { Session } from '../../common/auth';
import { PaymentMethodsController } from './sales.module';

describe('medios de pago iniciales', () => {
  it('completa idempotentemente los siete medios iniciales', async () => {
    const db = {
      paymentMethod: {
        createMany: jest.fn().mockResolvedValue({ count: 7 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const session: Session = { sub: 'u', companyId: 'company', branchId: null, roles: [], permissions: ['sales.access'], tokenVersion: 0 };
    await new PaymentMethodsController(db as never).list(session);
    const rows = db.paymentMethod.createMany.mock.calls[0][0].data;
    expect(rows.map((row: { code: string }) => row.code)).toEqual(['CASH', 'DEBIT', 'CREDIT', 'TRANSFER', 'MERCADO_PAGO', 'ACCOUNT_CURRENT', 'OTHER']);
    expect(rows.find((row: { code: string }) => row.code === 'CASH').kind).toBe('CASH');
    expect(rows.find((row: { code: string }) => row.code === 'ACCOUNT_CURRENT').requiresReference).toBe(true);
    expect(db.paymentMethod.findMany).toHaveBeenCalled();
  });
});
