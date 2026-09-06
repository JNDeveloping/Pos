import type { Session } from '../../common/auth';
import { StockService } from './stock.module';
const session: Session = { sub: 'u', companyId: 'c', branchId: null, roles: [], permissions: ['stock.adjust'], tokenVersion: 0 };
describe('reposición móvil', () => {
  it('mueve depósito a local sin modificar el stock total', async () => {
    const balances = [{ id: 'w', quantity: 24 }, { id: 's', quantity: 0 }];
    const tx = {
      $executeRaw: jest.fn(),
      branchProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'bp' }) },
      stockLocationBalance: { upsert: jest.fn().mockResolvedValueOnce(balances[0]).mockResolvedValueOnce(balances[1]), update: jest.fn() },
      stock: { findUnique: jest.fn().mockResolvedValue({ quantity: 24 }) },
      stockMovement: { createMany: jest.fn() }, auditLog: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn((callback) => callback(tx)) };
    const result = await new StockService(db as never).replenish(session, { branchId: '00000000-0000-4000-8000-000000000001', productId: '00000000-0000-4000-8000-000000000002', quantity: 8 });
    expect(result).toEqual({ quantity: 8, saleFloorQuantity: 8, warehouseQuantity: 16 });
    expect('update' in tx.stock).toBe(false);
    expect(tx.stockLocationBalance.update).toHaveBeenCalledTimes(2);
    expect(tx.stockMovement.createMany).toHaveBeenCalledTimes(1);
  });
});
