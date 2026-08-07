import Dexie, { type EntityTable } from 'dexie';
import type {
  LocalBarcode,
  LocalBrand,
  LocalBranch,
  LocalBranchProduct,
  LocalCategory,
  LocalProduct,
  LocalSetting,
  LocalSyncMetadata,
  LocalSyncQueue,
  LocalUserCache,
} from './types';

export class OfflineDatabase extends Dexie {
  products!: EntityTable<LocalProduct, 'id'>;
  productBarcodes!: EntityTable<LocalBarcode, 'id'>;
  categories!: EntityTable<LocalCategory, 'id'>;
  brands!: EntityTable<LocalBrand, 'id'>;
  branches!: EntityTable<LocalBranch, 'id'>;
  branchProducts!: EntityTable<LocalBranchProduct, 'id'>;
  usersCache!: EntityTable<LocalUserCache, 'id'>;
  settings!: EntityTable<LocalSetting, 'key'>;
  syncQueue!: EntityTable<LocalSyncQueue, 'id'>;
  syncMetadata!: EntityTable<LocalSyncMetadata, 'key'>;
  constructor() {
    super('rincon-offline');
    this.version(1).stores({
      products: 'id,companyId,internalCode,name,categoryId,brandId,active,updatedAt',
      productBarcodes: 'id,&[companyId+barcode],productId,barcode',
      categories: 'id,companyId,parentId,name,active',
      brands: 'id,companyId,name,active',
      branches: 'id,companyId,code,active',
      branchProducts: 'id,&[branchId+productId],branchId,productId,enabled',
      usersCache: 'id,cachedAt,offlineExpiresAt',
      settings: 'key',
      syncQueue: 'id,&operationId,status,createdAt',
      syncMetadata: 'key',
    });
  }
}
export const offlineDb = new OfflineDatabase();
