import type { Session } from '../../common/auth';
import { ProductsController } from './products.module';

const productId = '00000000-0000-4000-8000-000000000001';
const categoryId = '00000000-0000-4000-8000-000000000002';
const session: Session = {
  sub: 'user',
  companyId: 'company',
  branchId: null,
  roles: [],
  permissions: ['products.bulkUpdate'],
  tokenVersion: 0,
};

describe('edición masiva de productos', () => {
  it('actualiza relaciones en bloque y registra una auditoría de lote', async () => {
    const tx = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      branchProduct: { updateMany: jest.fn() },
      supplierProduct: { createMany: jest.fn(), updateMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      category: { findFirst: jest.fn().mockResolvedValue({ id: categoryId }) },
      product: { findMany: jest.fn().mockResolvedValue([{ id: productId, internalCode: 'P-1', name: 'Pan' }]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const controller = new ProductsController(db as never, {} as never);
    await expect(
      controller.bulkApply(session, { productIds: [productId], categoryId, subcategoryId: null }),
    ).resolves.toEqual(expect.objectContaining({ updated: 1 }));
    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId, subcategoryId: null }) }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'PRODUCTS_BULK_UPDATED',
        metadata: expect.objectContaining({ count: 1, productIds: [productId] }),
      }),
    });
  });
});
