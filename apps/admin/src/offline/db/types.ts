export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type ConnectionStatus = 'ONLINE' | 'OFFLINE' | 'SERVER_UNAVAILABLE' | 'SYNCING' | 'SYNC_ERROR';
export interface LocalProduct {
  id: string;
  companyId: string;
  categoryId: string;
  brandId?: string | null;
  internalCode: string;
  name: string;
  description?: string | null;
  unitType: string;
  taxRate: string;
  imageUrl?: string | null;
  active: boolean;
  updatedAt: string;
  deletedAt?: string | null;
}
export interface LocalBarcode {
  id: string;
  companyId: string;
  productId: string;
  barcode: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface LocalCategory {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  deletedAt?: string | null;
}
export interface LocalBrand {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  updatedAt: string;
  deletedAt?: string | null;
}
export interface LocalBranch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  active: boolean;
  updatedAt: string;
  deletedAt?: string | null;
}
export interface LocalBranchProduct {
  id: string;
  branchId: string;
  productId: string;
  cost: string;
  salePrice: string;
  margin: string;
  stockMinimum: string;
  enabled: boolean;
  updatedAt: string;
}
export interface LocalUserCache {
  id: string;
  profile: unknown;
  permissions: string[];
  company: unknown;
  branch: unknown;
  cachedAt: string;
  offlineExpiresAt: string;
}
export interface LocalSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}
export interface LocalSyncMetadata {
  key: string;
  value: string;
  updatedAt: string;
}
export interface LocalSyncQueue {
  id: string;
  operationId: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  status: SyncStatus;
  error?: string;
}
