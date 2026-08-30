import { ForbiddenException } from '@nestjs/common';
import type { Session } from '../../common/auth';
import { ProductsController } from './products.module';

const session = (roles: string[]): Session => ({ sub: 'u', companyId: 'c', branchId: null, roles, permissions: ['products.disable'], tokenVersion: 0 });

describe('baja completa de productos', () => {
  it('es exclusiva de SUPER_ADMIN', async () => {
    const controller = new ProductsController({} as never);
    await expect(controller.deleteAllSummary(session([]))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('usa operaciones masivas y conserva históricos', async () => {
    const tx = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 50000 }) },
      branchProduct: { updateMany: jest.fn().mockResolvedValue({ count: 50000 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = { $transaction: jest.fn((callback) => callback(tx)) };
    const controller = new ProductsController(db as never);
    await expect(controller.deleteAll(session(['SUPER_ADMIN']), 'ELIMINAR')).resolves.toEqual({ count: 50000 });
    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.branchProduct.updateMany).toHaveBeenCalledTimes(1);
  });
});
