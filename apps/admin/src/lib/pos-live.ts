import { io, type Socket } from 'socket.io-client';
import { readAccessToken } from './auth-session';

export type PosLiveActivity = {
  type: 'SCANNED' | 'CART_UPDATED' | 'ITEM_REMOVED' | 'DISCOUNT_APPLIED' | 'PAYMENT_STARTED' | 'PAYMENT_UPDATED' | 'SALE_COMPLETED' | 'SALE_CANCELLED';
  payload?: Record<string, unknown>;
};

export function connectPosLive(registration: { branchId: string; terminalId: string; cashSessionId: string }, initial?: PosLiveActivity) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const socket: Socket = io(window.location.origin, {
    path: `${base}api/socket.io`,
    auth: { token: readAccessToken() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  socket.on('connect', () => {
    socket.emit('pos:register', registration, () => {
      if (initial) socket.emit('pos:activity', initial);
    });
  });
  return socket;
}

export function sendPosActivity(socket: Socket | undefined, activity: PosLiveActivity) {
  if (socket?.connected) socket.emit('pos:activity', activity);
}
