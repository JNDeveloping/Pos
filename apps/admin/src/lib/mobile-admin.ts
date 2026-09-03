const DESKTOP_KEY = 'rincon.mobileAdmin.desktop';
export function isMobileAdminDevice(width = window.innerWidth, userAgent = navigator.userAgent) {
  const touchPhone = /Android|iPhone|iPod|Mobile/i.test(userAgent);
  return width <= 700 || (width <= 820 && touchPhone);
}
export function prefersDesktopAdmin() { return typeof localStorage !== 'undefined' && localStorage.getItem(DESKTOP_KEY) === 'true'; }
export function setDesktopAdminPreference(value: boolean) {
  if (typeof localStorage === 'undefined') return;
  if (value) localStorage.setItem(DESKTOP_KEY, 'true');
  else localStorage.removeItem(DESKTOP_KEY);
}
export function shouldOpenMobileAdmin(route: string, width?: number, userAgent?: string) {
  return route === '/admin' && !prefersDesktopAdmin() && isMobileAdminDevice(width, userAgent);
}
export function resolveMobileBranchId(current: string, initial: string | undefined, branches: { id: string }[]) {
  if (branches.some((branch) => branch.id === current)) return current;
  if (initial && branches.some((branch) => branch.id === initial)) return initial;
  return branches[0]?.id ?? '';
}
