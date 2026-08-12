import { FormEvent, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, PackagePlus, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { appPath } from '../lib/navigation';
type Ref = { id: string; name: string; parentId?: string };
type Config = {
  id: string;
  cost: string;
  salePrice: string;
  margin: string;
  stockMinimum: string;
  enabled: boolean;
  branch: Ref;
};
type Product = {
  id: string;
  internalCode: string;
  name: string;
  active: boolean;
  category: Ref;
  brand?: Ref;
  branchConfigs: Config[];
  barcodes: { barcode: string }[];
  _count?: { branchConfigs: number };
  presentationType?: string;
  netContent?: string;
  netContentUnit?: string;
};
type Page = { data: Product[]; meta: { page: number; pages: number; total: number } };
export function Products({ mode = 'branch' }: { mode?: 'branch' | 'master' }) {
  const [result, setResult] = useState<Page>(),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [show, setShow] = useState(false),
    [categories, setCategories] = useState<Ref[]>([]),
    [brands, setBrands] = useState<Ref[]>([]),
    [branches, setBranches] = useState<Ref[]>([]),
    [branchId, setBranchId] = useState<string>(),
    [enabledFilter, setEnabledFilter] = useState<'all' | 'true' | 'false'>(mode === 'branch' ? 'true' : 'all'),
    [enableDuringImport, setEnableDuringImport] = useState(mode === 'branch'),
    [importing, setImporting] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    [loadError, setLoadError] = useState('');
  const [dirty, setDirty] = useState(false);
  const load = async () => {
    setRefreshing(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ search, page: String(page), limit: '20' });
      if (branchId && enabledFilter !== 'all') {
        params.set('branchId', branchId);
        params.set('enabled', enabledFilter);
      }
      setResult(await api<Page>(`/products?${params}`));
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar los productos');
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void load();
  }, [page, branchId, enabledFilter, mode]);
  useEffect(() => {
    Promise.all([api<Ref[]>('/categories'), api<Ref[]>('/brands'), api<Ref[]>('/branches')])
      .then(([c, b, br]) => {
        setCategories(c);
        setBrands(b);
        setBranches(br);
        const selected = branchContext.get();
        setBranchId(br.length === 1 ? br[0].id : selected);
      })
      .catch((cause) => setLoadError(cause instanceof Error ? cause.message : 'No se cargaron las referencias'));
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api<{ id: string }>('/products', {
      method: 'POST',
      body: JSON.stringify({
        internalCode: f.get('internalCode') || undefined,
        name: f.get('name'),
        categoryId: f.get('categoryId'),
        subcategoryId: f.get('subcategoryId') || undefined,
        brandId: f.get('brandId') || undefined,
        unitType: f.get('unitType'),
        taxRate: f.get('taxRate'),
        shortName: f.get('shortName') || undefined,
        description: f.get('description') || undefined,
        sku: f.get('sku') || undefined,
        supplierReference: f.get('supplierReference') || undefined,
        presentationType: f.get('presentationType') || undefined,
        netContent: f.get('netContent') || undefined,
        netContentUnit: f.get('netContentUnit') || undefined,
        unitsPerCase: f.get('unitsPerCase') ? Number(f.get('unitsPerCase')) : undefined,
        caseBarcode: f.get('caseBarcode') || undefined,
        isWeighted: f.get('isWeighted') === 'on',
        allowManualPriceDefault: f.get('allowManualPriceDefault') === 'on',
        notes: f.get('notes') || undefined,
        barcode: f.get('barcode') || undefined,
        branchConfig: branchId
          ? {
              branchId,
              cost: String(f.get(`cost-${branchId}`) || '0'),
              salePrice: String(f.get(`price-${branchId}`) || '0'),
              stockMinimum: String(f.get(`stock-${branchId}`) || '0'),
              enabled: true,
              posFavorite: f.get(`favorite-${branchId}`) === 'on',
              allowManualPrice: f.get(`manual-${branchId}`) === 'on',
              location: f.get(`location-${branchId}`) || undefined,
              shelf: f.get(`shelf-${branchId}`) || undefined,
            }
          : undefined,
      }),
    });
    setShow(false);
    setDirty(false);
    load();
  }
  async function importExcel(file: File) {
    const { read, utils } = await import('xlsx');
    const started = performance.now();
    const workbook = read(await file.arrayBuffer());
    const rows = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
    const normalized = rows
      .map((row) => ({
        codigo: String(row.Codigo ?? row.CODIGO ?? '').trim(),
        descripcion: String(row.Descripcion ?? row.DESCRIPCION ?? '').trim(),
        rubro: String(row.Rubro ?? row.RUBRO ?? 'SIN CLASIFICAR').trim(),
        marca: String(row.Marca ?? row.MARCA ?? '').trim() || undefined,
        subcategoria: String(row.Subcategoria ?? row.SUBCATEGORIA ?? '').trim() || undefined,
        costo: row.Costo === undefined ? undefined : String(row.Costo),
        precio: row.Precio === undefined ? undefined : String(row.Precio),
        presentacion: row.Presentacion
          ? ({
              BOTELLA: 'BOTTLE',
              LATA: 'CAN',
              PAQUETE: 'PACKAGE',
              CAJA: 'BOX',
              BOLSA: 'BAG',
              FRASCO: 'JAR',
              UNIDAD: 'UNIT',
              BULTO: 'CASE',
            }[String(row.Presentacion).toUpperCase()] ?? String(row.Presentacion).toUpperCase())
          : undefined,
        contenido: row.Contenido === undefined ? undefined : String(row.Contenido),
        unidad: row.Unidad ? String(row.Unidad).toUpperCase() : undefined,
        unidadesPorBulto: row['Unidades por bulto'] ? Number(row['Unidades por bulto']) : undefined,
        barcodeBulto: row['Barcode bulto'] ? String(row['Barcode bulto']) : undefined,
        iva: row.IVA === undefined ? undefined : String(row.IVA),
        sku: row.SKU ? String(row.SKU) : undefined,
        ubicacion: row.Ubicacion ? String(row.Ubicacion) : undefined,
      }))
      .filter((row) => row.codigo && row.descripcion);
    if (!normalized.length) throw new Error('No se detectaron las columnas Codigo y Descripcion');
    const total = {
      created: 0,
      updated: 0,
      categoriesCreated: 0,
      brandsCreated: 0,
      skipped: 0,
      warnings: 0,
      errors: 0,
    };
    for (let offset = 0; offset < normalized.length; offset += 500) {
      setImporting(
        `Importando… ${Math.min(offset + 500, normalized.length).toLocaleString('es-AR')} / ${normalized.length.toLocaleString('es-AR')}`,
      );
      const result = await api<{
        created: number;
        updated: number;
        categoriesCreated: number;
        brandsCreated: number;
        skipped: number;
        warnings: string[];
        errors: string[];
      }>('/products/import', {
        method: 'POST',
        body: JSON.stringify({
          rows: normalized.slice(offset, offset + 500),
          branchId,
          enableForBranch: enableDuringImport,
        }),
      });
      total.created += result.created;
      total.updated += result.updated;
      total.categoriesCreated += result.categoriesCreated;
      total.brandsCreated += result.brandsCreated;
      total.skipped += result.skipped;
      total.warnings += result.warnings.length;
      total.errors += result.errors.length;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setImporting(
      `Finalizado en ${((performance.now() - started) / 1000).toFixed(1)} s · Nuevos ${total.created} · Actualizados ${total.updated} · Categorías ${total.categoriesCreated} · Marcas ${total.brandsCreated} · Omitidos ${total.skipped} · Advertencias ${total.warnings} · Errores ${total.errors}`,
    );
    await load();
  }
  async function exportCsv() {
    const rows = await api<Array<Record<string, unknown>>>(
      `/products/export/data${branchId ? `?branchId=${branchId}` : ''}`,
    );
    const header = [
      'Código',
      'Barcode',
      'Producto',
      'Categoría',
      'Subcategoría',
      'Marca',
      'Presentación',
      'Contenido',
      'IVA',
      'Costo',
      'Precio',
      'Margen',
    ];
    const csv = [
      header.join(','),
      ...rows.map((row) => {
        const category = row.category as { name?: string },
          subcategory = row.subcategory as { name?: string } | null,
          brand = row.brand as { name?: string } | null,
          barcodes = row.barcodes as { barcode: string }[],
          configs = row.branchConfigs as { cost?: string; salePrice: string; margin: string }[];
        return [
          row.internalCode,
          barcodes[0]?.barcode,
          row.name,
          category?.name,
          subcategory?.name,
          brand?.name,
          row.presentationType,
          `${row.netContent ?? ''} ${row.netContentUnit ?? ''}`,
          row.taxRate,
          configs[0]?.cost,
          configs[0]?.salePrice,
          configs[0]?.margin,
        ]
          .map((x) => `"${String(x ?? '').replaceAll('"', '""')}"`)
          .join(',');
      }),
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'productos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{mode === 'master' ? 'Catálogo maestro' : 'Productos de la sucursal'}</h1>
          <p className="mt-2 text-slate-500">
            {mode === 'master'
              ? 'Todos los artículos conocidos, estén habilitados o no.'
              : 'Sólo artículos comercializados y su configuración local.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => void exportCsv()}>
            <FileSpreadsheet size={18} />
            Exportar CSV
          </button>
          <label className="btn-secondary cursor-pointer">
            <FileSpreadsheet size={18} /> Importar Excel
            <input
              className="hidden"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importExcel(file).catch((error) => setImporting(error.message));
              }}
            />
          </label>
          <button className="btn" onClick={() => setShow(true)}>
            <PackagePlus size={19} />
            Nuevo producto
          </button>
        </div>
      </div>
      {importing && <p className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">{importing}</p>}
      {loadError && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{loadError}</p>}
      {refreshing && <p className="mt-3 text-sm text-slate-500">Cargando desde el servidor…</p>}
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={enableDuringImport}
          disabled={!branchId}
          onChange={(event) => setEnableDuringImport(event.target.checked)}
        />
        Importar al catálogo y habilitar automáticamente para la sucursal actual
      </label>
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
        {branchId && (
          <select
            value={enabledFilter}
            onChange={(e) => {
              setEnabledFilter(e.target.value as typeof enabledFilter);
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="true">
              Habilitado en {branches.find((branch) => branch.id === branchId)?.name ?? 'sucursal'}
            </option>
            <option value="false">No habilitado</option>
          </select>
        )}
      </form>
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {(mode === 'master'
                ? ['Código', 'Producto', 'Categoría', 'Marca', 'Sucursales', 'Estado', 'Acciones']
                : ['Código', 'Producto', 'Categoría', 'Marca', 'Precio', 'Costo', 'Margen', 'Estado', 'Acciones']
              ).map((x) => (
                <th className="p-4" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result?.data.map((p) => {
              const c = branchId ? p.branchConfigs.find((config) => config.branch.id === branchId) : p.branchConfigs[0];
              return (
                <tr className="border-b last:border-0" key={p.id}>
                  <td className="p-4 font-mono">{p.internalCode}</td>
                  <td className="p-4 font-semibold">
                    {p.name}
                    <small className="block text-slate-400">{p.barcodes[0]?.barcode}</small>
                  </td>
                  <td className="p-4">{p.category.name}</td>
                  <td className="p-4">{p.brand?.name ?? '—'}</td>
                  {mode === 'master' ? (
                    <td className="p-4">
                      {p._count?.branchConfigs ?? p.branchConfigs.filter((x) => x.enabled).length}
                    </td>
                  ) : (
                    <>
                      <td className="p-4 font-semibold">$ {Number(c?.salePrice ?? 0).toLocaleString('es-AR')}</td>
                      <td className="p-4">$ {Number(c?.cost ?? 0).toLocaleString('es-AR')}</td>
                      <td className="p-4">{c?.margin ?? 0}%</td>
                    </>
                  )}
                  <td className="p-4">
                    <span className="badge">{p.active ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <a className="text-brand-600" href={appPath(`/products/${p.id}`)}>
                        Ver ficha
                      </a>
                      {branchId &&
                        !p.branchConfigs.some((config) => config.branch.id === branchId && config.enabled) && (
                          <button
                            className="text-brand-600"
                            onClick={() =>
                              api(`/products/${p.id}/branches/${branchId}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ enabled: true }),
                              }).then(load)
                            }
                          >
                            Agregar a sucursal
                          </button>
                        )}
                      <a className="text-brand-600" href={appPath(`/products/${p.id}`)}>
                        Editar
                      </a>
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
          <form
            onSubmit={create}
            onChange={() => setDirty(true)}
            className="mx-auto my-6 max-w-5xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">Nuevo producto</h2>
                <p className="text-slate-500">
                  Se crea en el catálogo maestro y se habilita sólo en la sucursal actual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => (!dirty || confirm('Hay cambios sin guardar. ¿Salir igualmente?')) && setShow(false)}
              >
                <X />
              </button>
            </div>
            <h3 className="mt-7 font-bold">Datos generales</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input name="internalCode" placeholder="Código interno (automático si se deja vacío)" />
              <input name="name" placeholder="Nombre" required />
              <input name="shortName" placeholder="Nombre corto" />
              <textarea name="description" placeholder="Descripción" className="md:col-span-2" />
              <select name="categoryId" required>
                <option value="">Categoría</option>
                {categories.map((x) => (
                  <option value={x.id}>{x.name}</option>
                ))}
              </select>
              <select name="subcategoryId">
                <option value="">Sin subcategoría</option>
                {categories
                  .filter((x) => x.parentId)
                  .map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.name}
                    </option>
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
            <h3 className="mt-8 font-bold">Identificación y presentación</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <input name="sku" placeholder="SKU opcional" />
              <input name="supplierReference" placeholder="Referencia externa / proveedor" />
              <select name="presentationType">
                <option value="">Presentación</option>
                {[
                  'UNIT',
                  'BOTTLE',
                  'CAN',
                  'PACKAGE',
                  'BOX',
                  'BAG',
                  'JAR',
                  'SACHET',
                  'PACK',
                  'TRAY',
                  'DISPLAY',
                  'CASE',
                  'OTHER',
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input name="netContent" type="number" min="0" step="0.001" placeholder="Contenido neto" />
              <select name="netContentUnit">
                <option value="">Unidad contenido</option>
                {['ML', 'L', 'G', 'KG', 'UN', 'M', 'CM', 'OTHER'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input name="unitsPerCase" type="number" min="1" placeholder="Unidades por bulto" />
              <input name="caseBarcode" placeholder="Código de bulto" />
              <label className="flex items-center gap-2">
                <input name="isWeighted" type="checkbox" /> Producto pesable
              </label>
              <label className="flex items-center gap-2">
                <input name="allowManualPriceDefault" type="checkbox" /> Permitir precio manual
              </label>
              <textarea className="rounded-xl border p-3 md:col-span-3" name="notes" placeholder="Notas del producto" />
            </div>
            <h3 className="mt-8 font-bold">Configuración por sucursal</h3>
            <div className="mt-3 grid gap-3">
              {branches
                .filter((branch) => branch.id === branchId)
                .map((b) => (
                  <fieldset className="rounded-xl border p-4" key={b.id}>
                    <legend className="px-2 font-semibold">{b.name}</legend>
                    <div className="grid gap-3 md:grid-cols-3">
                      <input name={`cost-${b.id}`} type="number" min="0" step="0.01" placeholder="Costo" />
                      <input name={`price-${b.id}`} type="number" min="0" step="0.01" placeholder="Precio" />
                      <input name={`stock-${b.id}`} type="number" min="0" step="0.001" placeholder="Stock mínimo" />
                      <input name={`location-${b.id}`} placeholder="Ubicación (Pasillo / Góndola)" />
                      <input name={`shelf-${b.id}`} placeholder="Estante" />
                      <input name={`notes-${b.id}`} placeholder="Notas internas" />
                      <label className="flex items-center gap-2">
                        <input name={`favorite-${b.id}`} type="checkbox" /> Favorito POS
                      </label>
                      <label className="flex items-center gap-2">
                        <input name={`manual-${b.id}`} type="checkbox" /> Precio manual en sucursal
                      </label>
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
