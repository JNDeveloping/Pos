import { describe, expect, it } from 'vitest';
import { loginDestination } from './Login';

describe('destino posterior al login', () => {
  it('envía administradores al monitor del dueño', () => expect(loginDestination({ roles: ['ADMIN'], permissions: ['panels.admin'] })).toBe('/owner'));
  it('mantiene cajeros en el POS', () => expect(loginDestination({ roles: ['CAJERO'], permissions: ['panels.cashier'] })).toBe('/'));
  it('SUPER_ADMIN siempre ingresa al monitor', () => expect(loginDestination({ roles: ['SUPER_ADMIN'], permissions: [] })).toBe('/owner'));
});
