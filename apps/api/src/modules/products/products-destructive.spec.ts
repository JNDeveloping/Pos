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

describe('alta rápida de producto', () => {
  it('completa categoría y valores avanzados sin exigirlos al cliente móvil', async () => {
    const db = { category: { findFirst: jest.fn().mockResolvedValue({ id: 'category-default' }), create: jest.fn() } };
    const controller = new ProductsController(db as never);
    const create = jest.spyOn(controller, 'create').mockResolvedValue({ id: 'product' } as never);
    await controller.quickCreate(
      { sub: 'u', companyId: 'c', branchId: null, roles: [], permissions: ['products.create', 'prices.update'], tokenVersion: 0 },
      { name: 'Producto simple', barcode: '7791234567890', salePrice: '1500', branchId: '00000000-0000-4000-8000-000000000001' },
    );
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      name: 'Producto simple', barcode: '7791234567890', categoryId: 'category-default',
      branchConfig: expect.objectContaining({ salePrice: '1500', enabled: true }),
    }));
  });
});

describe('alta de producto', () => {
  it('encola automáticamente una etiqueta para la sucursal configurada', async () => {
    const tx = {
      company: { update: jest.fn().mockResolvedValue({ productSequence: 1 }) }, product: { create: jest.fn().mockResolvedValue({ id: 'product', name: 'Yerba' }) },
      branchProduct: { create: jest.fn() }, labelPrintQueue: { create: jest.fn() }, auditLog: { create: jest.fn() },
    };
    const db = {
      category: { findFirst: jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002' }) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const controller = new ProductsController(db as never);
    await controller.create(
      { sub: 'u', companyId: 'c', branchId: null, roles: [], permissions: ['products.create', 'prices.update'], tokenVersion: 0 },
      { name: 'Yerba', categoryId: '00000000-0000-4000-8000-000000000002', unitType: 'UNIT' as never, taxRate: '21', branchConfig: { branchId: '00000000-0000-4000-8000-000000000001', salePrice: '2500' } },
    );
    expect(tx.labelPrintQueue.create).toHaveBeenCalledWith({ data: expect.objectContaining({ productId: 'product', branchId: '00000000-0000-4000-8000-000000000001' }) });
  });
});
