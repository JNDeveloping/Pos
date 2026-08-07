import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { offlineDb } from './database';
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
});
