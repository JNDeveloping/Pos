import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PosCatalogService } from './sales.module';
const session = { sub: 'u', companyId: 'c', roles: [], permissions: [], tokenVersion: 0, branchId: null };
function database(product?: { active?: boolean; enabled?: boolean; price?: number }) {
  const row = product
    ? {
        id: 'p',
        name: 'Coca Cola',
        shortName: 'Coca',
        internalCode: 'BEB-1',
        sku: 'SKU',
        active: product.active ?? true,
        deletedAt: null,
        isWeighted: false,
        allowManualPriceDefault: false,
        presentationType: 'BOTTLE',
        unitType: 'UNIT',
        brand: { name: 'Coca Cola' },
        categoryId: 'cat',
        category: { name: 'Bebidas' },
        barcodes: [{ barcode: '779123', isPrimary: true }],
        branchConfigs:
          product.enabled === false
            ? []
            : [
                {
                  id: 'bp',
                  enabled: true,
                  salePrice: new Prisma.Decimal(product.price ?? 100),
                  stockMinimum: new Prisma.Decimal(2),
                  location: 'A1',
                  posFavorite: false,
                  allowManualPrice: false,
                },
              ],
      }
    : undefined;
  return {
    branch: { findFirst: jest.fn().mockResolvedValue({ allowNegativeStock: false, defaultPriceListId: null }) },
    product: { findMany: jest.fn().mockResolvedValue(row ? [row] : []), findFirst: jest.fn().mockResolvedValue(null) },
    stock: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          row ? [{ productId: 'p', quantity: new Prisma.Decimal(5), reservedQuantity: new Prisma.Decimal(0) }] : [],
        ),
    },
    priceListItem: { findMany: jest.fn().mockResolvedValue([]) },
    category: { findMany: jest.fn().mockResolvedValue([{ id: 'cat', name: 'Bebidas' }]) },
    posQuickGroup: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  };
}
describe('PosCatalogService', () => {
  it('resolves an indexed barcode with branch price and stock', async () => {
    const db = database({});
    const service = new PosCatalogService(db as never);
    expect(await service.byBarcode(session, 'b', '779123')).toMatchObject({
      name: 'Coca Cola',
      price: new Prisma.Decimal(100),
      available: 5,
    });
  });
  it('reports an unknown barcode precisely', async () => {
    const service = new PosCatalogService(database() as never);
    await expect(service.byBarcode(session, 'b', '779999')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects catalog products not enabled in the branch', async () => {
    const service = new PosCatalogService(database({ enabled: false }) as never);
    await expect(service.byBarcode(session, 'b', '779123')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('searches by text without loading the full catalog', async () => {
    const db = database({});
    const service = new PosCatalogService(db as never);
    await service.search(session, 'b', 'coca');
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 30 }));
  });
  it('lists quick groups without requiring catalog administration permissions', async () => {
    const db = database({});
    const service = new PosCatalogService(db as never);
    await expect(service.quickGroups(session, 'b')).resolves.toEqual([{ id: 'cat', name: 'Bebidas', icon: '', buttonSize: 'MEDIUM', kind: 'CATEGORY' }]);
    expect(db.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 16 }));
  });
});
