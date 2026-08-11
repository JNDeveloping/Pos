import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

function storageWith(values: Record<string, string> = {}) {
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete values[key];
    }),
  };
}

describe('cliente API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explica cuando Apache devuelve index.html en lugar de JSON', async () => {
    vi.stubGlobal('sessionStorage', storageWith());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } })),
    );

    await expect(api('/auth/login')).rejects.toThrow('está devolviendo HTML en lugar de la API');
  });

  it('conserva el mensaje de error JSON enviado por NestJS', async () => {
    vi.stubGlobal('sessionStorage', storageWith());
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Credenciales inválidas' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(api('/auth/login')).rejects.toThrow('Credenciales inválidas');
  });

  it('un error de red no elimina la sesión local', async () => {
    const storage = storageWith({ accessToken: 'access', refreshToken: 'refresh' });
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(api('/products')).rejects.toThrow('Failed to fetch');
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('comparte un único refresh entre requests 401 concurrentes', async () => {
    const storage = storageWith({ accessToken: 'expired', refreshToken: 'refresh' });
    vi.stubGlobal('sessionStorage', storage);
    let refreshCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) {
          refreshCalls++;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const authorization = init?.headers as Record<string, string> | undefined;
        return authorization?.Authorization === 'Bearer new-access'
          ? new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
          : new Response(JSON.stringify({ message: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
      }),
    );
    await Promise.all([api('/products'), api('/categories')]);
    expect(refreshCalls).toBe(1);
  });
});
