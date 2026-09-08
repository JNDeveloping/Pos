import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate, subscribeToNavigation } from './navigation';

describe('navegación SPA', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cambia de ruta sin recargar el documento', () => {
    const pushState = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { history: { pushState }, dispatchEvent });
    navigate('/products');
    expect(pushState).toHaveBeenCalledWith({}, '', '/pos/products');
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });

  it('desuscribe el listener de navegación', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });
    const listener = vi.fn();
    subscribeToNavigation(listener)();
    expect(addEventListener).toHaveBeenCalledWith('popstate', listener);
    expect(removeEventListener).toHaveBeenCalledWith('popstate', listener);
  });
});
