import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service';

describe('sincronización multi-tab', () => {
  it('Web Lock permite una sola sincronización pesada', async () => {
    let busy = false;
    const locks = {
      request: vi.fn(async (_name: string, _options: LockOptions, callback: (lock: Lock | null) => Promise<void>) => {
        if (busy) return callback(null);
        busy = true;
        try {
          return await callback({ name: 'rincon-catalog-sync', mode: 'exclusive' } as Lock);
        } finally {
          busy = false;
        }
      }),
    };
    vi.stubGlobal('navigator', { ...navigator, locks });
    const first = new SyncService();
    const second = new SyncService();
    let executions = 0;
    const heavy = async () => {
      executions++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    };
    (first as unknown as { run: () => Promise<void> }).run = heavy;
    (second as unknown as { run: () => Promise<void> }).run = heavy;

    await Promise.all([first.sync(), second.sync()]);
    expect(executions).toBe(1);
    expect(locks.request).toHaveBeenCalledTimes(2);
  });
});
