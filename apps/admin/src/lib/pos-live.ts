import { io, type Socket } from 'socket.io-client';
import { readAccessToken } from './auth-session';

export type PosLiveActivity = {
  type:
    | 'SCANNED'
    | 'CART_UPDATED'
    | 'ITEM_REMOVED'
    | 'DISCOUNT_APPLIED'
    | 'PAYMENT_STARTED'
    | 'PAYMENT_UPDATED'
    | 'SALE_COMPLETED'
    | 'SALE_CANCELLED';
  payload?: Record<string, unknown>;
};

export type PosLiveConnectionHandlers = {
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onError?: (message: string) => void;
};

export function posLivePath(baseUrl = import.meta.env.BASE_URL) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}api/socket.io`;
}

export function createPosLiveSocket(handlers: PosLiveConnectionHandlers = {}) {
  const socket: Socket = io(window.location.origin, {
    path: posLivePath(),
    auth: { token: readAccessToken() },
    // Polling mantiene el canal disponible aunque el proxy todavía no acepte
    // Upgrade. Socket.IO asciende a WebSocket cuando la infraestructura puede.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  socket.io.on('reconnect_attempt', () => {
    socket.auth = { token: readAccessToken() };
  });
  socket.on('connect', () => handlers.onConnected?.());
  socket.on('disconnect', (reason) => handlers.onDisconnected?.(reason));
  socket.on('connect_error', (error) => handlers.onError?.(error.message));
  socket.on('pos:error', (error: { message?: string }) =>
    handlers.onError?.(error.message ?? 'No se pudo registrar la conexión en vivo'),
  );
  return socket;
}

export function connectPosLive(
  registration: { branchId: string; terminalId: string; cashSessionId: string },
  initial?: PosLiveActivity,
  handlers: PosLiveConnectionHandlers = {},
) {
  const socket = createPosLiveSocket(handlers);
  socket.on('connect', () => {
    socket.emit('pos:register', registration, (response?: { ok?: boolean; message?: string }) => {
      if (!response?.ok) {
        handlers.onError?.(response?.message ?? 'La terminal no pudo registrarse en Cajas en vivo');
        return;
      }
      if (initial) socket.emit('pos:activity', initial);
    });
  });
  return socket;
}

export function sendPosActivity(socket: Socket | undefined, activity: PosLiveActivity) {
  if (socket?.connected) socket.emit('pos:activity', activity);
}
