type Tokens = { accessToken: string; refreshToken: string };
type AuthMessage = { type: 'REQUEST' } | { type: 'SESSION'; tokens: Tokens } | { type: 'LOGOUT' };
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('rincon-auth-session');
const waiters = new Set<(tokens?: Tokens) => void>();
const listeners = new Set<(tokens?: Tokens) => void>();

function current(): Tokens | undefined {
  const persistent = typeof localStorage === 'undefined' ? undefined : localStorage;
  const accessToken = sessionStorage.getItem('accessToken') ?? persistent?.getItem('accessToken');
  const refreshToken = sessionStorage.getItem('refreshToken') ?? persistent?.getItem('refreshToken');
  if (accessToken && refreshToken) {
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
  }
  return accessToken && refreshToken ? { accessToken, refreshToken } : undefined;
}
channel?.addEventListener('message', ({ data }: MessageEvent<AuthMessage>) => {
  if (data.type === 'REQUEST') {
    const tokens = current();
    if (tokens) channel.postMessage({ type: 'SESSION', tokens } satisfies AuthMessage);
  } else if (data.type === 'SESSION') {
    sessionStorage.setItem('accessToken', data.tokens.accessToken);
    sessionStorage.setItem('refreshToken', data.tokens.refreshToken);
    waiters.forEach((resolve) => resolve(data.tokens));
    waiters.clear();
    listeners.forEach((listener) => listener(data.tokens));
  } else {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    listeners.forEach((listener) => listener());
  }
});

export function storeTokens(tokens: Tokens) {
  sessionStorage.setItem('accessToken', tokens.accessToken);
  sessionStorage.setItem('refreshToken', tokens.refreshToken);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }
  listeners.forEach((listener) => listener(tokens));
}
export function clearTokens() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
  channel?.postMessage({ type: 'LOGOUT' } satisfies AuthMessage);
  listeners.forEach((listener) => listener());
}
export const subscribeToAuthSession = (listener: (tokens?: Tokens) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const readAccessToken = () => current()?.accessToken;
export const readRefreshToken = () => current()?.refreshToken;
export async function requestTabSession(timeoutMs = 600): Promise<Tokens | undefined> {
  const existing = current();
  if (existing || !channel) return existing;
  return new Promise((resolve) => {
    const finish = (tokens?: Tokens) => { waiters.delete(finish); resolve(tokens); };
    waiters.add(finish);
    channel.postMessage({ type: 'REQUEST' } satisfies AuthMessage);
    window.setTimeout(() => finish(), timeoutMs);
  });
}
