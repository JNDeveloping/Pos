import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Building2, FolderTree, Package, PackageCheck, Tags, Users } from 'lucide-react';
import { api } from '../lib/api';
import { offlineDb } from '../offline/db/database';
import { deviceConfig } from '../offline/db/device';
type S = {
  products: number;
  activeProducts: number;
  activeBranches: number;
  activeUsers: number;
  categories: number;
  productsWithoutPrice: number;
  productsWithoutBranchConfig: number;
  enabledInBranch: number;
};
export function Dashboard() {
  const [s, setS] = useState<S>();
  useEffect(() => {
    async function load() {
      const device = await deviceConfig();
      try {
        setS(await api<S>(`/dashboard/summary${device.branchId ? `?branchId=${device.branchId}` : ''}`));
      } catch {
        const [products, activeProducts, activeBranches, categories] = await Promise.all([
          offlineDb.products.count(),
          offlineDb.products.filter((product) => product.active).count(),
          offlineDb.branches.filter((branch) => branch.active).count(),
          offlineDb.categories.count(),
        ]);
        setS({
          products,
          activeProducts,
          activeBranches,
          activeUsers: await offlineDb.usersCache.count(),
          categories,
          productsWithoutPrice: await offlineDb.branchProducts
            .filter((config) => Number(config.salePrice) === 0)
            .count(),
          productsWithoutBranchConfig: 0,
          enabledInBranch: await offlineDb.branchProducts
            .filter((config) => config.enabled && (!device.branchId || config.branchId === device.branchId))
            .count(),
        });
      }
    }
    void load();
  }, []);
  const cards: [string, number | undefined, LucideIcon][] = [
    ['Productos en catálogo', s?.products, Package],
    ['Productos habilitados en sucursal', s?.enabledInBranch, PackageCheck],
    ['Sucursales activas', s?.activeBranches, Building2],
    ['Usuarios activos', s?.activeUsers, Users],
    ['Categorías', s?.categories, FolderTree],
    ['Sin precio', s?.productsWithoutPrice, Tags],
  ];
  return (
    <>
      <p className="text-xs font-bold tracking-widest text-brand-600">RESUMEN GENERAL</p>
      <h1 className="mt-2 text-3xl font-bold">Panel administrativo</h1>
      <p className="mt-2 text-slate-500">
        Estado actual del catálogo y la organización, sin datos ficticios de ventas.
      </p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, Icon]) => (
          <article className="card p-6" key={label as string}>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">{label as string}</span>
              <Icon className="text-brand-600" />
            </div>
            <b className="mt-4 block text-3xl">{value === undefined ? '—' : String(value)}</b>
          </article>
        ))}
      </section>
      {s?.productsWithoutBranchConfig ? (
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-800">
          {s.productsWithoutBranchConfig} productos todavía no tienen configuración por sucursal.
        </p>
      ) : null}
    </>
  );
}
