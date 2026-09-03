import { beforeEach, describe, expect, it } from 'vitest';
import { setDesktopAdminPreference, shouldOpenMobileAdmin } from './mobile-admin';
describe('detección del administrador móvil', () => {
  const values = new Map<string,string>();
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => values.set(key,value), removeItem: (key:string) => values.delete(key), clear: () => values.clear() } });
  });
  it('redirige teléfonos pero no PCs ni la propia ruta móvil', () => {
    expect(shouldOpenMobileAdmin('/admin', 390, 'iPhone')).toBe(true);
    expect(shouldOpenMobileAdmin('/admin', 1440, 'Chrome')).toBe(false);
    expect(shouldOpenMobileAdmin('/admin/mobile', 390, 'iPhone')).toBe(false);
  });
  it('respeta la preferencia de escritorio', () => {
    setDesktopAdminPreference(true);
    expect(shouldOpenMobileAdmin('/admin', 390, 'iPhone')).toBe(false);
  });
});
