export type PosSettings = {
  mode: 'compact' | 'touch';
  showStock: boolean;
  showBarcode: boolean;
  showClock: boolean;
  favoriteColumns: number;
  confirmCancel: boolean;
  autoPrintTicket: boolean;
};
export const DEFAULT_POS_SETTINGS: PosSettings = {
  mode: 'compact',
  showStock: true,
  showBarcode: true,
  showClock: true,
  favoriteColumns: 4,
  confirmCancel: true,
  autoPrintTicket: false,
};
export function loadPosSettings(branchId?: string): PosSettings {
  if (!branchId) return DEFAULT_POS_SETTINGS;
  try {
    return { ...DEFAULT_POS_SETTINGS, ...JSON.parse(localStorage.getItem(`pos-settings:${branchId}`) ?? '{}') };
  } catch {
    return DEFAULT_POS_SETTINGS;
  }
}
export function savePosSettings(branchId: string, settings: PosSettings) {
  localStorage.setItem(`pos-settings:${branchId}`, JSON.stringify(settings));
}
