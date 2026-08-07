import { offlineDb } from '../db/database';
import type { LocalSyncQueue } from '../db/types';
export class QueueRepository {
  pending() {
    return offlineDb.syncQueue.where('status').anyOf('PENDING', 'FAILED').sortBy('createdAt');
  }
  count() {
    return offlineDb.syncQueue.where('status').anyOf('PENDING', 'FAILED', 'SYNCING').count();
  }
  async enqueue(input: Omit<LocalSyncQueue, 'id' | 'operationId' | 'createdAt' | 'attempts' | 'status'>) {
    const operationId = crypto.randomUUID();
    await offlineDb.syncQueue.add({
      ...input,
      id: crypto.randomUUID(),
      operationId,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING',
    });
    return operationId;
  }
  async syncing(ids: string[]) {
    await offlineDb.syncQueue
      .where('id')
      .anyOf(ids)
      .modify({ status: 'SYNCING', lastAttemptAt: new Date().toISOString() });
  }
  async synced(operationIds: string[]) {
    await offlineDb.syncQueue.where('operationId').anyOf(operationIds).modify({ status: 'SYNCED', error: undefined });
  }
  async failed(id: string, error: string) {
    const row = await offlineDb.syncQueue.get(id);
    if (row)
      await offlineDb.syncQueue.update(id, {
        status: 'FAILED',
        attempts: row.attempts + 1,
        error,
        lastAttemptAt: new Date().toISOString(),
      });
  }
}
export const queueRepository = new QueueRepository();
