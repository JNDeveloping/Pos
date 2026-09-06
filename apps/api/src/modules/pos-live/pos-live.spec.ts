import { PosLiveService, sanitizePayload } from './pos-live.module';

describe('caja en vivo', () => {
  it('publica sólo el snapshot operativo permitido', () => {
    expect(sanitizePayload('CART_UPDATED', {
      total: 1500,
      cardNumber: '4500000000000000',
      token: 'secret',
      items: [{ name: 'Pan', quantity: 2, subtotal: 1500, cost: 10 }],
    })).toEqual({ total: 1500, items: [{ name: 'Pan', quantity: 2, subtotal: 1500 }] });
  });
  it('considera una terminal online mientras conserve al menos un socket', () => {
    const service = new PosLiveService();
    service.connect('terminal', 'one'); service.connect('terminal', 'two');
    service.disconnect('terminal', 'one'); expect(service.onlineTerminalIds()).toEqual(['terminal']);
    service.disconnect('terminal', 'two'); expect(service.onlineTerminalIds()).toEqual([]);
  });
});
