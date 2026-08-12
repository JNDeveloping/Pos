const KEY = 'rincon.currentBranchId';

export const branchContext = {
  get: () => localStorage.getItem(KEY) || undefined,
  set: (branchId?: string) => (branchId ? localStorage.setItem(KEY, branchId) : localStorage.removeItem(KEY)),
};
