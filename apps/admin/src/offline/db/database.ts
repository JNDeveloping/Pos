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
    this.version(2)
      .stores({
        products:
          'id,companyId,&[companyId+internalCode],internalCode,normalizedName,*searchTerms,categoryId,brandId,active,updatedAt',
        productBarcodes: 'id,&[companyId+barcode],productId,barcode',
        categories: 'id,companyId,parentId,name,active',
        brands: 'id,companyId,name,active',
        branches: 'id,companyId,code,active',
        branchProducts: 'id,&[branchId+productId],branchId,productId,enabled,posFavorite',
        usersCache: 'id,cachedAt,offlineExpiresAt',
        settings: 'key',
        syncQueue: 'id,&operationId,status,createdAt',
        syncMetadata: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table<LocalProduct, string>('products')
          .toCollection()
          .modify((product) => {
            Object.assign(product, searchableProduct(product));
          }),
      );
  }
}

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchableProduct(product: Pick<LocalProduct, 'name' | 'shortName' | 'internalCode'>) {
  const normalizedName = normalizeSearch(`${product.name} ${product.shortName ?? ''}`);
  const words = normalizedName.split(' ').filter(Boolean);
  const searchTerms = [
    ...new Set(
      words.flatMap((word) =>
        Array.from({ length: Math.max(0, word.length - 1) }, (_, index) => word.slice(0, index + 2)),
      ),
    ),
  ];
  return { normalizedName, searchTerms };
}
export const offlineDb = new OfflineDatabase();
