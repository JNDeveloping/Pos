import { offlineDb } from '../db/database';
import type {
  LocalBarcode,
  LocalBrand,
  LocalBranch,
  LocalBranchProduct,
  LocalCategory,
  LocalProduct,
} from '../db/types';
export type SyncEntity = 'COMPANY' | 'BRANCH' | 'CATEGORY' | 'BRAND' | 'PRODUCT' | 'PRODUCT_BARCODE' | 'BRANCH_PRODUCT';
const tables = {
  BRANCH: offlineDb.branches,
  CATEGORY: offlineDb.categories,
  BRAND: offlineDb.brands,
  PRODUCT: offlineDb.products,
  PRODUCT_BARCODE: offlineDb.productBarcodes,
  BRANCH_PRODUCT: offlineDb.branchProducts,
} as const;
export class CatalogRepository {
  async apply(entityType: SyncEntity, entityId: string, operation: 'UPSERT' | 'DELETE', payload: unknown) {
    if (entityType === 'COMPANY') {
      if (operation === 'UPSERT')
        await offlineDb.settings.put({ key: 'company', value: payload, updatedAt: new Date().toISOString() });
      return;
    }
    const table = tables[entityType];
    if (operation === 'DELETE') {
      await table.delete(entityId);
      if (entityType === 'PRODUCT') {
        await offlineDb.productBarcodes.where('productId').equals(entityId).delete();
        await offlineDb.branchProducts.where('productId').equals(entityId).delete();
      }
      return;
    }
    if (payload) await table.put(payload as never);
  }
  async products() {
    const products = await offlineDb.products.toArray();
    return products.filter((product) => product.active).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  async productViews() {
    const products = await this.products();
    return Promise.all(
      products.map(async (product) => ({
        ...product,
        category: (await offlineDb.categories.get(product.categoryId)) ?? {
          id: product.categoryId,
          name: 'Sin categoría',
        },
        brand: product.brandId ? await offlineDb.brands.get(product.brandId) : undefined,
        barcodes: await offlineDb.productBarcodes.where('productId').equals(product.id).toArray(),
        branchConfigs: await Promise.all(
          (await offlineDb.branchProducts.where('productId').equals(product.id).toArray()).map(async (config) => ({
            ...config,
            branch: (await offlineDb.branches.get(config.branchId)) ?? { id: config.branchId, name: 'Sucursal' },
          })),
        ),
      })),
    );
  }
  async productByBarcode(barcode: string) {
    const code = await offlineDb.productBarcodes.where('barcode').equals(barcode).first();
    return code ? offlineDb.products.get(code.productId) : undefined;
  }
  async counts() {
    const [products, barcodes, categories, brands, branches, branchProducts] = await Promise.all([
      offlineDb.products.count(),
      offlineDb.productBarcodes.count(),
      offlineDb.categories.count(),
      offlineDb.brands.count(),
      offlineDb.branches.count(),
      offlineDb.branchProducts.count(),
    ]);
    return { products, barcodes, categories, brands, branches, branchProducts };
  }
  async clearDownloaded() {
    await offlineDb.transaction(
      'rw',
      [
        offlineDb.products,
        offlineDb.productBarcodes,
        offlineDb.categories,
        offlineDb.brands,
        offlineDb.branches,
        offlineDb.branchProducts,
      ],
      () =>
        Promise.all([
          offlineDb.products.clear(),
          offlineDb.productBarcodes.clear(),
          offlineDb.categories.clear(),
          offlineDb.brands.clear(),
          offlineDb.branches.clear(),
          offlineDb.branchProducts.clear(),
        ]),
    );
  }
}
export const catalogRepository = new CatalogRepository();
export type CatalogRecord = LocalProduct | LocalBarcode | LocalCategory | LocalBrand | LocalBranch | LocalBranchProduct;
