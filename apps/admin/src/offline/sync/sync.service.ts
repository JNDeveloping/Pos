import { api } from '../../lib/api';
import { connectivityService } from '../connectivity/connectivity.service';
import { offlineDb } from '../db/database';
import { deviceConfig } from '../db/device';
import type { ConnectionStatus } from '../db/types';
import { queueRepository } from '../queue/queue.repository';
import { catalogRepository, type SyncEntity } from '../repositories/catalog.repository';
type SyncChange = {
  version: string;
  entityType: SyncEntity;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  payload: unknown;
};
type Listener = (state: SyncState) => void;
export interface SyncState {
  status: ConnectionStatus;
  lastSuccessfulSync?: string;
  pending: number;
  progress?: string;
  error?: string;
}
export class SyncService {
  private running?: Promise<void>;
  private initialized?: Promise<void>;
  private listeners = new Set<Listener>();
  private state: SyncState = { status: connectivityService.current, pending: 0 };
  private reconnectTimer?: number;
  private lastConnectivity = connectivityService.current;
  private channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('rincon-sync');
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private async emit(patch: Partial<SyncState> = {}) {
    this.state = { ...this.state, ...patch, pending: await queueRepository.count() };
    this.listeners.forEach((x) => x(this.state));
  }
  async initialize() {
    if (this.initialized) return this.initialized;
    this.initialized = this.initializeOnce();
    return this.initialized;
  }
  private async initializeOnce() {
    const meta = await offlineDb.syncMetadata.get('lastSuccessfulSync');
    await this.emit({ lastSuccessfulSync: meta?.value });
    connectivityService.subscribe((status) => {
      const recovered = status === 'ONLINE' && this.lastConnectivity !== 'ONLINE';
      this.lastConnectivity = status;
      void this.emit({ status: this.running ? 'SYNCING' : status });
      if (recovered) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => void this.sync(), 0);
      }
    });
    this.channel?.addEventListener('message', (event: MessageEvent<{ type: string; at?: string }>) => {
      if (event.data.type === 'SYNC_COMPLETED')
        void this.emit({ status: connectivityService.current, lastSuccessfulSync: event.data.at, progress: undefined });
    });
  }
  sync() {
    if (this.running) return this.running;
    this.running = this.withLeaderLock().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async withLeaderLock() {
    if (!navigator.locks) return this.run();
    await navigator.locks.request('rincon-catalog-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        await this.emit({ status: connectivityService.current, progress: 'Sincronización activa en otra pestaña' });
        return;
      }
      await this.run();
    });
  }
  private async run() {
    if (!(await connectivityService.probe())) {
      await this.emit({ status: connectivityService.current });
      return;
    }
    await this.emit({ status: 'SYNCING', error: undefined, progress: 'Enviando operaciones pendientes' });
    try {
      await this.push();
      await this.pull();
      const now = new Date().toISOString();
      await offlineDb.syncMetadata.put({ key: 'lastSuccessfulSync', value: now, updatedAt: now });
      await this.emit({ status: 'ONLINE', lastSuccessfulSync: now, progress: undefined });
      this.channel?.postMessage({ type: 'SYNC_COMPLETED', at: now });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de sincronización';
      await this.emit({ status: 'SYNC_ERROR', error: message, progress: undefined });
    }
  }
  private async push() {
    const pending = await queueRepository.pending();
    if (!pending.length) return;
    const config = await deviceConfig();
    await queueRepository.syncing(pending.map((x) => x.id));
    try {
      const response = await api<{ results: { operationId: string; status: string; error?: string }[] }>(
        '/sync/operations',
        {
          method: 'POST',
          body: JSON.stringify({
            deviceId: config.deviceId,
            operations: pending.map(({ operationId, entityId, entityType, operation, payload }) => ({
              operationId,
              entityId,
              entityType,
              operation,
              payload,
            })),
          }),
        },
      );
      const completed = response.results.filter((item) => ['PROCESSED', 'ALREADY_PROCESSED'].includes(item.status));
      await queueRepository.synced(completed.map((item) => item.operationId));
      for (const result of response.results.filter((item) => item.status === 'UNSUPPORTED')) {
        const row = pending.find((item) => item.operationId === result.operationId);
        if (row) await queueRepository.failed(row.id, result.error ?? 'Operación todavía no soportada por el servidor');
      }
    } catch (error) {
      for (const row of pending)
        await queueRepository.failed(row.id, error instanceof Error ? error.message : 'Error de envío');
      throw error;
    }
  }
  private async pull() {
    const config = await deviceConfig();
    let cursor = (await offlineDb.syncMetadata.get('cursor'))?.value ?? '0',
      hasMore = true,
      page = 0;
    while (hasMore) {
      page++;
      await this.emit({ progress: `Descargando cambios · lote ${page}` });
      const params = new URLSearchParams({ cursor, limit: '500' });
      if (config.branchId) params.set('branchId', config.branchId);
      const response = await api<{ cursor: string; hasMore: boolean; changes: SyncChange[] }>(
        `/sync/changes?${params}`,
      );
      await offlineDb.transaction(
        'rw',
        [
          offlineDb.products,
          offlineDb.productBarcodes,
          offlineDb.categories,
          offlineDb.brands,
          offlineDb.branches,
          offlineDb.branchProducts,
          offlineDb.settings,
        ],
        async () => {
          for (const change of response.changes)
            await catalogRepository.apply(change.entityType, change.entityId, change.operation, change.payload);
        },
      );
      cursor = response.cursor;
      hasMore = response.hasMore;
      await offlineDb.syncMetadata.put({ key: 'cursor', value: cursor, updatedAt: new Date().toISOString() });
    }
  }
  async rebuild() {
    if (!(await connectivityService.probe())) throw new Error('Se necesita conexión para reconstruir los datos');
    await catalogRepository.clearDownloaded();
    await offlineDb.syncMetadata.put({ key: 'cursor', value: '0', updatedAt: new Date().toISOString() });
    await this.sync();
  }
  async storage() {
    const estimate = await navigator.storage?.estimate?.();
    return { ...(await catalogRepository.counts()), usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 };
  }
}
export const syncService = new SyncService();
