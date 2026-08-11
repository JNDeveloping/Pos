import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const storage = { getItem: vi.fn(() => null), removeItem: vi.fn() };

describe('cliente API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explica cuando Apache devuelve index.html en lugar de JSON', async () => {
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } })),
    );

    await expect(api('/auth/login')).rejects.toThrow('está devolviendo HTML en lugar de la API');
  });

  it('conserva el mensaje de error JSON enviado por NestJS', async () => {
    vi.stubGlobal('sessionStorage', storage);
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
});
