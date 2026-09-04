import { FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, FileSpreadsheet, PackagePlus, Search, Trash2, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { api, hasPermission, type Me } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { appPath, currentRoute } from '../lib/navigation';
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
  family?: Ref;
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
    [branches, setBranches] = useState<Ref[]>([]),
    [branchId, setBranchId] = useState<string>(),
    [enabledFilter, setEnabledFilter] = useState<'all' | 'true' | 'false'>(mode === 'branch' ? 'true' : 'all'),
    [enableDuringImport, setEnableDuringImport] = useState(mode === 'branch'),
    [importing, setImporting] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    [loadError, setLoadError] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set()), [scannerOpen, setScannerOpen] = useState(false), [cameraActive, setCameraActive] = useState(false);
  const scannerVideo = useRef<HTMLVideoElement>(null), scannerControls = useRef<IScannerControls | undefined>(undefined), scanned = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [me, setMe] = useState<Me>();
  const [deleteAll, setDeleteAll] = useState<{ count: number; confirmation: string }>();
  const load = async (requestedSearch = search, requestedPage = page) => {
    setRefreshing(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ search: requestedSearch, page: String(requestedPage), limit: '20' });
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
    void api<Me>('/auth/me').then(async (current) => {
      setMe(current); setIsSuperAdmin(current.user.roles.some((role) => role.code === 'SUPER_ADMIN'));
      return Promise.all([hasPermission(current, 'categories.view') ? api<Ref[]>('/categories') : Promise.resolve([]), api<Ref[]>(hasPermission(current, 'branches.view') ? '/branches' : '/cash-sessions/branches')]);
    })
      .then(([c, br]) => {
        setCategories(c);
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
  useEffect(() => () => stopScanner(), []);
  async function startScanner() {
    setScannerOpen(true); setLoadError(''); scanned.current = false;
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!scannerVideo.current) return;
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      scannerControls.current = await new BrowserMultiFormatReader().decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, scannerVideo.current, (result) => {
        if (!result || scanned.current) return;
        scanned.current = true; const code = result.getText().trim(); stopScanner(); setScannerOpen(false); setSearch(code); setPage(1); void load(code, 1);
      });
      setCameraActive(true);
    } catch { stopScanner(); setLoadError('No se pudo abrir la cámara. Revisá el permiso del navegador o escribí el código manualmente.'); }
  }
  function stopScanner() { scannerControls.current?.stop(); scannerControls.current = undefined; setCameraActive(false); }
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
        imageUrl: f.get('imageUrl') || undefined,
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
              allowManualPrice: f.get('allowManualPriceDefault') === 'on',
              location: f.get(`location-${branchId}`) || undefined,
              shelf: f.get(`shelf-${branchId}`) || undefined,
              saleFloorStock: String(f.get(`sale-floor-${branchId}`) || '0'),
              warehouseStock: String(f.get(`warehouse-${branchId}`) || '0'),
            }
          : undefined,
      }),
    });
    setShow(false);
    setDirty(false);
    setImporting('Producto creado y etiqueta agregada a la cola de impresión.');
    void load();
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
          <p className="eyebrow">CATÁLOGO Y VENTA</p><h1 className="text-3xl font-bold">Productos</h1>
          <p className="mt-2 text-slate-500">Buscá, editá precios y organizá el surtido sin cambiar de sección.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(me, 'products.export') && <button className="btn-secondary" onClick={() => void exportCsv()}>
            <FileSpreadsheet size={18} />
            Exportar CSV
          </button>}
          {hasPermission(me, 'products.import') && <label className="btn-secondary cursor-pointer">
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
          </label>}
          {hasPermission(me, 'products.create') && <button className="btn" onClick={() => setShow(true)}>
            <PackagePlus size={19} />
            Nuevo producto
          </button>}
          {isSuperAdmin && <button className="btn-secondary text-red-700" onClick={async () => { const summary = await api<{ count: number }>('/products/bulk-delete-all/summary'); setDeleteAll({ count: summary.count, confirmation: '' }); }}><Trash2 size={18}/>Eliminar todos</button>}
        </div>
      </div>
      {selected.size > 0 && (
        <div className="bulk-action-bar">
          <b>{selected.size} seleccionados</b>
          {hasPermission(me, 'prices.bulkUpdate') && <button
            onClick={async () => {
              const pct = Number(prompt('Porcentaje de aumento (use negativo para disminuir)', '6'));
              if (!Number.isFinite(pct) || !branchId) return;
              await api('/prices/bulk/apply', {
                method: 'POST',
                body: JSON.stringify({
                  branchId,
                  operation: 'PERCENT',
                  value: String(pct),
                  products: [...selected].map((productId) => ({ productId })),
                }),
              });
              setSelected(new Set());
              await load();
            }}
          >
            Aumentar precios
          </button>}
          <button onClick={() => (window.location.href = appPath('/labels'))}>Generar etiquetas</button>
          {hasPermission(me, 'products.disable') && <button
            className="text-red-700"
            onClick={async () => {
              if (!confirm(`Se eliminarán ${selected.size} productos. ¿Continuar?`)) return;
              await api('/products/bulk-disable', {
                method: 'POST',
                body: JSON.stringify({ productIds: [...selected] }),
              });
              setSelected(new Set());
              await load();
            }}
          >
            Desactivar
          </button>}
        </div>
      )}
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
        <button type="button" className="btn-secondary" onClick={() => void startScanner()} title="Escanear código con la cámara"><Camera size={18}/><span className="hidden sm:inline">Escanear</span></button>
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
      {scannerOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Escanear código de barras"><section className="modal-card max-w-xl"><header className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Escanear código de barras</h2><p className="text-sm text-slate-500">Apuntá la cámara al código del producto.</p></div><button type="button" aria-label="Cerrar scanner" onClick={() => { stopScanner(); setScannerOpen(false); }}><X/></button></header><div className="scanner-frame mt-5"><video ref={scannerVideo} muted playsInline/>{!cameraActive && <Camera size={64}/>}<i/></div><p className="mt-4 text-center text-sm text-slate-500">La cámara trasera se elige automáticamente cuando está disponible.</p></section></div>}
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-4">
                <input
                  type="checkbox"
                  aria-label="Seleccionar página"
                  checked={Boolean(result?.data.length) && selected.size === result?.data.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(result?.data.map((p) => p.id)) : new Set())}
                />
              </th>
              {(mode === 'master'
                ? ['Código', 'Producto', 'Categoría', 'Familia', 'Sucursales', 'Estado', 'Acciones']
                : ['Código', 'Producto', 'Categoría', 'Familia', 'Precio', 'Costo', 'Margen', 'Estado', 'Acciones']
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
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="p-4 font-mono">{p.internalCode}</td>
                  <td className="p-4 font-semibold">
                    {p.name}
                    <small className="block text-slate-400">{p.barcodes[0]?.barcode}</small>
                  </td>
                  <td className="p-4">{p.category.name}</td>
                  <td className="p-4">{p.family?.name ?? '—'}</td>
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
                      <a className="font-semibold text-brand-700" href={appPath(`${currentRoute().startsWith('/cashier') ? '/cashier' : ''}/products/${p.id}`)}>
                        Abrir producto
                      </a>
                      {c && hasPermission(me, 'prices.update') && <button className="text-brand-700" onClick={async () => {
                        const next = prompt(`Nuevo precio para ${p.name}`, String(c.salePrice));
                        if (next === null || !branchId || !Number.isFinite(Number(next)) || Number(next) < 0) return;
                        await api(`/products/${p.id}/branches/${branchId}`, { method: 'PATCH', body: JSON.stringify({ salePrice: next }) });
                        await load();
                      }}>Cambiar precio</button>}
                      {hasPermission(me, 'products.update') && branchId &&
                        !p.branchConfigs.some((config) => config.branch.id === branchId && config.enabled) && (
                          <button
                            className="text-brand-600"
                            onClick={() =>
                              api(`/products/${p.id}/branches/${branchId}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ enabled: true }),
                              }).then(() => load())
                            }
                          >
                            Agregar a sucursal
                          </button>
                        )}
                      {p.active && hasPermission(me, 'products.disable') && (
                        <button
                          className="text-red-600"
                          onClick={() => api(`/products/${p.id}`, { method: 'DELETE' }).then(() => load())}
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
      {deleteAll && <div className="modal-backdrop"><section className="modal-card border-2 border-red-600"><div className="flex justify-between"><div><p className="font-bold text-red-700">ZONA DE PELIGRO · SUPER_ADMIN</p><h2 className="text-2xl font-bold">Eliminar todos los productos</h2></div><button onClick={() => setDeleteAll(undefined)}><X/></button></div><p>Se desactivarán mediante soft delete <b>{deleteAll.count.toLocaleString('es-AR')} productos</b>. Las ventas, compras, movimientos e historiales permanecerán guardados.</p><label>Escribí <b>ELIMINAR</b> para confirmar<input autoFocus value={deleteAll.confirmation} onChange={(e) => setDeleteAll({ ...deleteAll, confirmation: e.target.value })}/></label><button className="min-h-14 bg-red-700 text-white" disabled={deleteAll.confirmation !== 'ELIMINAR'} onClick={async () => { const result = await api<{ count: number }>('/products/bulk-delete-all', { method: 'POST', body: JSON.stringify({ confirmation: deleteAll.confirmation }) }); setDeleteAll(undefined); setImporting(`${result.count} productos fueron desactivados.`); await load(); }}>Eliminar catálogo completo</button></section></div>}
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
            <div className="product-create-sections">
              <fieldset><legend>General</legend><div className="grid gap-3 md:grid-cols-2">
                <label>Nombre<input name="name" required placeholder="Ej. Banana" /></label>
                <label>Código interno<input name="internalCode" placeholder="Automático si se deja vacío" /></label>
                <label>Barcode<input name="barcode" inputMode="numeric" placeholder="Escanear o escribir" /></label>
                <label>Categoría<select name="categoryId" required><option value="">Seleccionar</option>{categories.filter((item) => !item.parentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="md:col-span-2">URL de imagen<input name="imageUrl" type="url" placeholder="https://…" /></label>
              </div></fieldset>
              <fieldset><legend>Venta</legend><div className="grid gap-3 md:grid-cols-3">
                <label>Precio<input name={`price-${branchId}`} type="number" min="0" step="0.01" required /></label>
                <label>Costo<input name={`cost-${branchId}`} type="number" min="0" step="0.01" required /></label>
                <label>Unidad<select name="unitType"><option value="UNIT">Unidad</option><option value="KG">Kilogramo</option><option value="GRAM">Gramo</option><option value="LITER">Litro</option><option value="METER">Metro</option></select></label>
                <input type="hidden" name="taxRate" value="21"/><label className="check-field"><input name="isWeighted" type="checkbox"/>Producto pesable</label><label className="check-field"><input name="allowManualPriceDefault" type="checkbox"/>Permitir precio manual</label><label className="check-field"><input name={`favorite-${branchId}`} type="checkbox"/>Favorito del POS</label>
              </div></fieldset>
              <fieldset><legend>Stock</legend><div className="grid gap-3 md:grid-cols-3">
                <label>Local de venta<input name={`sale-floor-${branchId}`} type="number" min="0" step="0.001" defaultValue="0"/></label>
                <label>Depósito<input name={`warehouse-${branchId}`} type="number" min="0" step="0.001" defaultValue="0"/></label>
                <label>Stock mínimo<input name={`stock-${branchId}`} type="number" min="0" step="0.001" defaultValue="0"/></label>
              </div></fieldset>
              <fieldset><legend>Proveedores</legend><p>Guardá el producto y agregá uno o varios proveedores desde su ficha, sin recargar este formulario.</p><label>Código o referencia inicial<input name="supplierReference" placeholder="Código del proveedor (opcional)"/></label></fieldset>
              <details><summary>Opcional · Lotes y vencimientos</summary><p className="mt-2 text-sm text-slate-500">Los lotes se cargan al recibir compras o desde la ficha del producto para mantener trazabilidad.</p></details>
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
