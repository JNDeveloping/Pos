const KEY = 'rincon.currentBranchId';

export const branchContext = {
  get: () => sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || undefined,
  set: (branchId?: string) => {
    if (branchId) {
      sessionStorage.setItem(KEY, branchId);
      localStorage.setItem(KEY, branchId);
    } else {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    }
  },
};
