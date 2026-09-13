const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export const appPath = (path = '/') => `${base}${path.replace(/^\//, '')}`;

export const currentRoute = () => {
  const pathname = window.location.pathname;
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.slice(1);
  return `/${relative}`.replace(/\/$/, '') || '/';
};

export const navigate = (path: string, options?: { replace?: boolean }) => {
  const destination = appPath(path);
  if (options?.replace) window.history.replaceState({}, '', destination);
  else window.history.pushState({}, '', destination);
  window.dispatchEvent(new Event('popstate'));
};

export const subscribeToNavigation = (listener: () => void) => {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
};
