import { describe, expect, it } from 'vitest';
import { posLivePath } from './pos-live';

describe('pos live socket path', () => {
  it('conserva el prefijo público con o sin barra final', () => {
    expect(posLivePath('/pos/')).toBe('/pos/api/socket.io');
    expect(posLivePath('/pos')).toBe('/pos/api/socket.io');
  });
});
