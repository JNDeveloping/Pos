import { FormEvent, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, PackagePlus, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { offlineDb } from '../offline/db/database';
import { catalogRepository } from '../offline/repositories/catalog.repository';
type Ref = { id: string; name: string };
type Config = { id: string; cost: string; salePrice: string; margin: string; stockMinimum: string; branch: Ref };
type Product = {
  id: string;
  internalCode: string;
  name: string;
  active: boolean;
  category: Ref;
  brand?: Ref;
  branchConfigs: Config[];
  barcodes: { barcode: string }[];
};
type Page = { data: Product[]; meta: { page: number; pages: number; total: number } };
export function Products() {
  const [result, setResult] = useState<Page>(),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [show, setShow] = useState(false),
    [categories, setCategories] = useState<Ref[]>([]),
    [brands, setBrands] = useState<Ref[]>([]),
    [branches, setBranches] = useState<Ref[]>([]);
  const load = async () => {
    try {
      setResult(await api<Page>(`/products?search=${encodeURIComponent(search)}&page=${page}&limit=20`));
    } catch {
      const all = (await catalogRepository.productViews()) as unknown as Product[];
      const term = search.toLocaleLowerCase('es');
      const filtered = all.filter(
        (product) =>
          !term ||
          product.name.toLocaleLowerCase('es').includes(term) ||
          product.internalCode.toLocaleLowerCase('es').includes(term) ||
          product.barcodes.some((barcode) => barcode.barcode.includes(term)),
      );
      setResult({
        data: filtered.slice((page - 1) * 20, page * 20),
        meta: { page, pages: Math.ceil(filtered.length / 20), total: filtered.length },
      });
    }
  };
  useEffect(() => {
    void load();
  }, [page]);
  useEffect(() => {
    Promise.all([
      api<Ref[]>('/categories').catch(() => offlineDb.categories.toArray()),
      api<Ref[]>('/brands').catch(() => offlineDb.brands.toArray()),
      api<Ref[]>('/branches').catch(() => offlineDb.branches.toArray()),
    ]).then(([c, b, br]) => {
      setCategories(c);
      setBrands(b);
      setBranches(br);
    });
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = await api<{ id: string }>('/products', {
      method: 'POST',
      body: JSON.stringify({
        internalCode: f.get('internalCode'),
        name: f.get('name'),
        categoryId: f.get('categoryId'),
        brandId: f.get('brandId') || undefined,
        unitType: f.get('unitType'),
        taxRate: f.get('taxRate'),
      }),
    });
    for (const b of branches) {
      const cost = String(f.get(`cost-${b.id}`) || '0'),
        salePrice = String(f.get(`price-${b.id}`) || '0');
      await api(`/products/${p.id}/branches/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ cost, salePrice, stockMinimum: String(f.get(`stock-${b.id}`) || '0') }),
      });
    }
    const barcode = String(f.get('barcode') || '');
    if (barcode)
      await api(`/products/${p.id}/barcodes`, { method: 'POST', body: JSON.stringify({ barcode, isPrimary: true }) });
    setShow(false);
    load();
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="mt-2 text-slate-500">Catálogo y configuración comercial por sucursal.</p>
        </div>
        <button className="btn" onClick={() => setShow(true)}>
          <PackagePlus size={19} />
          Nuevo producto
        </button>
      </div>
      <form
        className="card mt-7 flex gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <Search className="ml-2 self-center text-slate-400" />
        <input
          className="min-w-0 flex-1 border-0 focus:ring-0"
          placeholder="Buscar por nombre, código interno o código de barras…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-secondary">Buscar</button>
      </form>
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {['Código', 'Producto', 'Categoría', 'Marca', 'Precio', 'Costo', 'Margen', 'Estado', 'Acciones'].map(
                (x) => (
                  <th className="p-4" key={x}>
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {result?.data.map((p) => {
              const c = p.branchConfigs[0];
              return (
                <tr className="border-b last:border-0" key={p.id}>
                  <td className="p-4 font-mono">{p.internalCode}</td>
                  <td className="p-4 font-semibold">
                    {p.name}
                    <small className="block text-slate-400">{p.barcodes[0]?.barcode}</small>
                  </td>
                  <td className="p-4">{p.category.name}</td>
                  <td className="p-4">{p.brand?.name ?? '—'}</td>
                  <td className="p-4 font-semibold">$ {Number(c?.salePrice ?? 0).toLocaleString('es-AR')}</td>
                  <td className="p-4">$ {Number(c?.cost ?? 0).toLocaleString('es-AR')}</td>
                  <td className="p-4">{c?.margin ?? 0}%</td>
                  <td className="p-4">
                    <span className="badge">{p.active ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        className="text-brand-600"
                        onClick={() =>
                          alert(p.branchConfigs.map((x) => `${x.branch.name}: $${x.salePrice}`).join('\n'))
                        }
                      >
                        Ver
                      </button>
                      <button
                        className="text-brand-600"
                        onClick={() => {
                          const name = prompt('Nombre del producto', p.name);
                          if (name)
                            api(`/products/${p.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }).then(load);
                        }}
                      >
                        Editar
                      </button>
                      {p.active && (
                        <button
                          className="text-red-600"
                          onClick={() => api(`/products/${p.id}`, { method: 'DELETE' }).then(load)}
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <footer className="flex items-center justify-between border-t p-4 text-sm">
          <span>{result?.meta.total ?? 0} productos</span>
          <div className="flex items-center gap-3">
            <button disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>
              <ChevronLeft />
            </button>
            <span>
              Página {page} de {result?.meta.pages || 1}
            </span>
            <button disabled={page >= (result?.meta.pages || 1)} onClick={() => setPage((x) => x + 1)}>
              <ChevronRight />
            </button>
          </div>
        </footer>
      </div>
      {show && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <form onSubmit={create} className="mx-auto my-6 max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">Nuevo producto</h2>
                <p className="text-slate-500">Datos generales y valores por sucursal.</p>
              </div>
              <button type="button" onClick={() => setShow(false)}>
                <X />
              </button>
            </div>
            <h3 className="mt-7 font-bold">Datos generales</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input name="internalCode" placeholder="Código interno" required />
              <input name="name" placeholder="Nombre" required />
              <select name="categoryId" required>
                <option value="">Categoría</option>
                {categories.map((x) => (
                  <option value={x.id}>{x.name}</option>
                ))}
              </select>
              <select name="brandId">
                <option value="">Sin marca</option>
                {brands.map((x) => (
                  <option value={x.id}>{x.name}</option>
                ))}
              </select>
              <select name="unitType">
                <option>UNIT</option>
                <option>KG</option>
                <option>GRAM</option>
                <option>LITER</option>
                <option>METER</option>
              </select>
              <input name="taxRate" type="number" min="0" value="21" readOnly />
              <input name="barcode" placeholder="Código de barras principal" />
            </div>
            <h3 className="mt-8 font-bold">Configuración por sucursal</h3>
            <div className="mt-3 grid gap-3">
              {branches.map((b) => (
                <fieldset className="rounded-xl border p-4" key={b.id}>
                  <legend className="px-2 font-semibold">{b.name}</legend>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input name={`cost-${b.id}`} type="number" min="0" step="0.01" placeholder="Costo" />
                    <input name={`price-${b.id}`} type="number" min="0" step="0.01" placeholder="Precio" />
                    <input name={`stock-${b.id}`} type="number" min="0" step="0.001" placeholder="Stock mínimo" />
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShow(false)}>
                Cancelar
              </button>
              <button className="btn">Guardar producto</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
