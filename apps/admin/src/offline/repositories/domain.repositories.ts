import { api } from '../../lib/api';
import { offlineDb } from '../db/database';
import type { LocalBrand, LocalBranch, LocalCategory } from '../db/types';
import { catalogRepository } from './catalog.repository';

export const productRepository = {
  searchLocal: catalogRepository.searchProducts.bind(catalogRepository),
  byBarcodeLocal: catalogRepository.productByBarcode.bind(catalogRepository),
};

function referenceRepository<T extends { id: string }>(table: { toArray(): Promise<T[]> }, path: string) {
  return {
    local: () => table.toArray(),
    async refresh(): Promise<T[]> {
      return api<T[]>(path);
    },
  };
}

export const categoryRepository = referenceRepository<LocalCategory>(offlineDb.categories, '/categories');
export const brandRepository = referenceRepository<LocalBrand>(offlineDb.brands, '/brands');
export const branchRepository = referenceRepository<LocalBranch>(offlineDb.branches, '/branches');
export const branchProductRepository = {
  localForBranch: (branchId: string) => offlineDb.branchProducts.where('branchId').equals(branchId).toArray(),
  localForProduct: (productId: string) => offlineDb.branchProducts.where('productId').equals(productId).toArray(),
};
