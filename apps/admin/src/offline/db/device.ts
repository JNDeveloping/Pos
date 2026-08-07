import { offlineDb } from './database';
export interface DeviceConfig {
  deviceId: string;
  name: string;
  branchId?: string;
  terminalId?: string;
}
export async function deviceConfig(): Promise<DeviceConfig> {
  const row = await offlineDb.settings.get('deviceConfig');
  if (row) return row.value as DeviceConfig;
  const value = { deviceId: crypto.randomUUID(), name: `PWA-${crypto.randomUUID().slice(0, 8).toUpperCase()}` };
  await offlineDb.settings.put({ key: 'deviceConfig', value, updatedAt: new Date().toISOString() });
  return value;
}
export async function saveDeviceConfig(value: DeviceConfig) {
  const previous = await offlineDb.settings.get('deviceConfig');
  await offlineDb.settings.put({ key: 'deviceConfig', value, updatedAt: new Date().toISOString() });
  if ((previous?.value as DeviceConfig | undefined)?.branchId !== value.branchId) {
    await offlineDb.branchProducts.clear();
    await offlineDb.syncMetadata.put({ key: 'cursor', value: '0', updatedAt: new Date().toISOString() });
  }
}
