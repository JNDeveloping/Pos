import { navigate } from './navigation';
import { clearTokens, storeTokens } from './auth-session';

export const API = (import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`).replace(/\/$/, '');
export type Me = {
  user: { id: string; username: string; firstName: string; lastName: string; roles: { code: string }[] };
  permissions: string[];
  branch?: { name: string };
  company: { name: string };
};
export const hasRole = (me: Me | undefined, role: string) => me?.user.roles.some(({ code }) => code === role) ?? false;
export const hasPermission = (me: Me | undefined, permission: string) =>
  hasRole(me, 'SUPER_ADMIN') || (me?.permissions.includes(permission) ?? false);
export const hasAnyPermission = (me: Me | undefined, permissions: string[]) =>
  hasRole(me, 'SUPER_ADMIN') || permissions.some((permission) => me?.permissions.includes(permission));

type ApiErrorBody = { error?: { message?: string }; message?: string };
type Tokens = { accessToken: string; refreshToken: string };
let refreshInFlight: Promise<string> | undefined;

async function readApiBody(response: Response) {
  const raw = await response.text();
  if (!raw) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const receivedHtml = /^\s*(?:<!doctype|<html)/i.test(raw);
    throw new Error(
      receivedHtml
        ? `La ruta ${API} está devolviendo HTML en lugar de la API. Verificá ProxyPass para /pos/api/ hacia 127.0.0.1:3002 y que el backend esté activo antes del fallback de React.`
        : `La API respondió un formato inesperado (${contentType || 'sin Content-Type'}).`,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('La API respondió JSON inválido. Revisá el proxy y los logs del backend.');
  }
}

export async function api<T>(path: string, options: RequestInit = {}) {
  let token = sessionStorage.getItem('accessToken');
  const requestHeaders = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !requestHeaders.has('Content-Type'))
    requestHeaders.set('Content-Type', 'application/json');
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  let response = await request(`${API}${path}`, { ...options, headers: requestHeaders });
  if (response.status === 401 && !path.startsWith('/auth/')) {
    token = await refreshAccessToken();
    requestHeaders.set('Authorization', `Bearer ${token}`);
    response = await request(`${API}${path}`, { ...options, headers: requestHeaders });
  }
  const body = await readApiBody(response);
  if (!response.ok) {
    const error = body as ApiErrorBody | undefined;
    throw new Error(error?.error?.message ?? error?.message ?? `Error HTTP ${response.status}`);
  }
  return body as T;
}

async function request(url: string, options: RequestInit) {
  try {
    return await fetch(url, options);
  } catch (cause) {
    throw new Error('Sin conexión al servidor. Verificá la red e intentá nuevamente.', { cause });
  }
}

function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

async function performRefresh() {
  const refreshToken = sessionStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('La sesión expiró. Volvé a ingresar.');
  const response = await request(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = (await readApiBody(response)) as Tokens | ApiErrorBody;
  if (!response.ok) {
    clearTokens();
    navigate('/login');
    throw new Error((body as ApiErrorBody).error?.message ?? 'La sesión expiró');
  }
  const tokens = body as Tokens;
  storeTokens(tokens);
  return tokens.accessToken;
}
export const can = hasPermission;
