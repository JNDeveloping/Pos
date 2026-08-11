import { navigate } from './navigation';

export const API = (import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`).replace(/\/$/, '');
export type Me = {
  user: { id: string; username: string; firstName: string; lastName: string; roles: { code: string }[] };
  permissions: string[];
  branch?: { name: string };
  company: { name: string };
};

type ApiErrorBody = { error?: { message?: string }; message?: string };

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
  const token = sessionStorage.getItem('accessToken');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    if (!path.includes('/auth/')) navigate('/login');
  }
  const body = await readApiBody(response);
  if (!response.ok) {
    const error = body as ApiErrorBody | undefined;
    throw new Error(error?.error?.message ?? error?.message ?? `Error HTTP ${response.status}`);
  }
  return body as T;
}
export const can = (me: Me | undefined, p: string) => me?.permissions.includes(p) ?? false;
