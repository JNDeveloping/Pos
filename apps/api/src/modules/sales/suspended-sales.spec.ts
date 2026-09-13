import { BadRequestException, ConflictException } from '@nestjs/common';
import { sanitizeSuspendedCart, SuspendedSalesService } from './sales.module';

const productLine = {
  id: 'product-1',
  productId: '11111111-1111-4111-8111-111111111111',
  branchProductId: '22222222-2222-4222-8222-222222222222',
  name: 'Yerba 1 kg',
  internalCode: '100',
  unitType: 'UNIT',
  price: '1500',
  available: 10,
  stockMinimum: 2,
  isWeighted: false,
  posFavorite: false,
  allowManualPrice: false,
  quantity: 2,
  originalPrice: 1500,
  discountPercent: 10,
  discountAmount: 100,
};

describe('ventas suspendidas persistidas', () => {
  it('calcula en backend el total del snapshot sin confiar en el navegador', () => {
    const result = sanitizeSuspendedCart([productLine]);
    expect(result.itemCount).toBe(1);
    expect(result.total.toString()).toBe('2600');
    expect(result.snapshot[0]).toMatchObject({ productId: productLine.productId, quantity: 2 });
  });

  it('conserva una venta rápida sin inventar referencias de producto', () => {
    const result = sanitizeSuspendedCart([
      {
        ...productLine,
        id: 'quick-1',
        quickSale: true,
        productId: undefined,
        branchProductId: '',
        name: 'Pan suelto',
      },
    ]);
    expect(result.snapshot[0].productId).toBeUndefined();
  });

  it('rechaza carritos vacíos o descuentos inválidos', () => {
    expect(() => sanitizeSuspendedCart([])).toThrow(BadRequestException);
    expect(() => sanitizeSuspendedCart([{ ...productLine, discountPercent: 101 }])).toThrow(
      'El descuento de una venta suspendida supera 100%',
    );
  });

  it('impide que dos cajas recuperen el mismo carrito', async () => {
    const row = {
      id: '33333333-3333-4333-8333-333333333333',
      companyId: '44444444-4444-4444-8444-444444444444',
      branchId: '55555555-5555-4555-8555-555555555555',
      terminalId: '66666666-6666-4666-8666-666666666666',
      itemCount: 1,
      total: { toString: () => '1500' },
      status: 'PENDING',
    };
    const tx = {
      suspendedSale: {
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn() },
    };
    const db = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: row.branchId }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new SuspendedSalesService(db as never);
    await expect(
      service.recover(
        {
          sub: '77777777-7777-4777-8777-777777777777',
          companyId: row.companyId,
          branchId: row.branchId,
          roles: [],
          permissions: ['sales.create'],
          tokenVersion: 0,
        },
        row.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
