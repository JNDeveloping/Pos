import { normalizeSearch, offlineDb, searchableProduct } from '../db/database';
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
    if (payload) {
      const value =
        entityType === 'PRODUCT'
          ? { ...(payload as LocalProduct), ...searchableProduct(payload as LocalProduct) }
          : payload;
      await table.put(value as never);
    }
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
  async searchProducts(query: string, branchId?: string, enabled?: boolean, page = 1, limit = 20) {
    const term = normalizeSearch(query);
    let products: LocalProduct[];
    if (!term && branchId && enabled === true) {
      const configs = (await offlineDb.branchProducts.where('branchId').equals(branchId).toArray()).filter(
        (config) => config.enabled,
      );
      const total = configs.length;
      const rows = await offlineDb.products.bulkGet(
        configs.slice((page - 1) * limit, page * limit).map((config) => config.productId),
      );
      return {
        data: await this.viewsFor(rows.filter((product): product is LocalProduct => Boolean(product?.active))),
        meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
    if (!term && (!branchId || enabled === undefined)) {
      const total = await offlineDb.products.filter((product) => product.active).count();
      const rows = await offlineDb.products
        .orderBy('normalizedName')
        .offset((page - 1) * limit)
        .limit(limit)
        .toArray();
      return {
        data: await this.viewsFor(rows.filter((product) => product.active)),
        meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      };
    }
    const barcode = query.trim();
    const exactBarcode = barcode ? await offlineDb.productBarcodes.where('barcode').equals(barcode).first() : undefined;
    if (exactBarcode) {
      const product = await offlineDb.products.get(exactBarcode.productId);
      products = product ? [product] : [];
    } else if (term) {
      const codeMatches = await offlineDb.products.where('internalCode').startsWithIgnoreCase(query.trim()).toArray();
      const firstWord = term.split(' ')[0];
      const nameMatches = firstWord ? await offlineDb.products.where('searchTerms').equals(firstWord).toArray() : [];
      products = [...new Map([...codeMatches, ...nameMatches].map((product) => [product.id, product])).values()].filter(
        (product) =>
          product.internalCode.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) ||
          product.normalizedName.includes(term),
      );
    } else products = [];
    products = products.filter((product) => product.active);
    if (branchId && enabled !== undefined) {
      const configs = await offlineDb.branchProducts.where('branchId').equals(branchId).toArray();
      const allowed = new Set(configs.filter((config) => config.enabled).map((config) => config.productId));
      products = products.filter((product) => allowed.has(product.id) === enabled);
    }
    products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const total = products.length;
    const selected = products.slice((page - 1) * limit, page * limit);
    return {
      data: await this.viewsFor(selected),
      meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }
  private async viewsFor(products: LocalProduct[]) {
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
