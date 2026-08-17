import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ConnectivityService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('inicializa una sola vez y comparte el sondeo en vuelo', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
      setTimeout,
      clearTimeout,
    });
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { ConnectivityService } = await import('./connectivity.service');
    const service = new ConnectivityService();

    service.start();
    service.start();
    const first = service.check();
    const second = service.check();
    expect(first).toBe(second);
    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(new Response('{}', { status: 200 }));
    await first;
    service.stop();
    expect(removeEventListener).toHaveBeenCalledTimes(2);
  });
});
