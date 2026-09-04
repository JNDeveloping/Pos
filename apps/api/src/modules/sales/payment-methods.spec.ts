import type { Session } from '../../common/auth';
import { PaymentMethodsController } from './sales.module';

describe('medios de pago iniciales', () => {
  it('crea los seis medios seguros cuando la empresa todavía no tiene configuración', async () => {
    const db = {
      paymentMethod: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockResolvedValue({ count: 6 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const session: Session = { sub: 'u', companyId: 'company', branchId: null, roles: [], permissions: ['sales.access'], tokenVersion: 0 };
    await new PaymentMethodsController(db as never).list(session);
    const rows = db.paymentMethod.createMany.mock.calls[0][0].data;
    expect(rows.map((row: { code: string }) => row.code)).toEqual(['CASH', 'DEBIT', 'CREDIT', 'TRANSFER', 'MERCADO_PAGO', 'OTHER']);
    expect(db.paymentMethod.findMany).toHaveBeenCalled();
  });
});
