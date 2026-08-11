import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { offlineDb, searchableProduct } from './database';
import { deviceConfig } from './device';
import { catalogRepository } from '../repositories/catalog.repository';
import { queueRepository } from '../queue/queue.repository';

describe('persistencia offline', () => {
  beforeEach(async () => {
    await offlineDb.delete();
    await offlineDb.open();
  });

  it('conserva un Device ID estable', async () => {
    expect((await deviceConfig()).deviceId).toBe((await deviceConfig()).deviceId);
  });

  it('reconstruye catálogos sin borrar la cola pendiente', async () => {
    await catalogRepository.apply('PRODUCT', '10000000-0000-4000-8000-000000000001', 'UPSERT', {
      id: '10000000-0000-4000-8000-000000000001',
      companyId: '20000000-0000-4000-8000-000000000001',
      categoryId: '30000000-0000-4000-8000-000000000001',
      internalCode: 'TEST',
      name: 'Producto',
      unitType: 'UNIT',
      taxRate: '21',
      active: true,
      updatedAt: new Date().toISOString(),
    });
    await queueRepository.enqueue({
      entityType: 'DEVICE',
      entityId: crypto.randomUUID(),
      operation: 'UPDATE',
      payload: {},
    });
    await catalogRepository.clearDownloaded();
    expect(await offlineDb.products.count()).toBe(0);
    expect(await queueRepository.count()).toBe(1);
  });

  it('busca por nombre normalizado, código interno y barcode entre 50.000 productos', async () => {
    const now = new Date().toISOString();
    const products = Array.from({ length: 50_000 }, (_, index) => {
      const product = {
        id: `product-${index}`,
        companyId: 'company-performance',
        categoryId: 'category-performance',
        internalCode: `PROD-${String(index).padStart(5, '0')}`,
        name: index === 42_321 ? 'Coca-Cola Zero 2,25L' : `Artículo ${index}`,
        unitType: 'UNIT',
        taxRate: '21',
        active: true,
        updatedAt: now,
      };
      return { ...product, ...searchableProduct(product) };
    });
    await offlineDb.products.bulkPut(products);
    await offlineDb.productBarcodes.put({
      id: 'barcode-performance',
      companyId: 'company-performance',
      productId: 'product-42321',
      barcode: '7791234567890',
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });

    expect((await catalogRepository.searchProducts('coca cola')).data[0]?.id).toBe('product-42321');
    expect((await catalogRepository.searchProducts('PROD-42321')).data[0]?.id).toBe('product-42321');
    expect((await catalogRepository.searchProducts('7791234567890')).data[0]?.id).toBe('product-42321');
  }, 60_000);
});
