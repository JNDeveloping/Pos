export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
export type Me = {
  user: { id: string; username: string; firstName: string; lastName: string; roles: { code: string }[] };
  permissions: string[];
  branch?: { name: string };
  company: { name: string };
};
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
    if (!path.includes('/auth/')) location.href = '/login';
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? body.message ?? 'Error inesperado');
  return body as T;
}
export const can = (me: Me | undefined, p: string) => me?.permissions.includes(p) ?? false;
