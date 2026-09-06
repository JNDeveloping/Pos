import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Barcode, Boxes, History, Save, Store, Truck, Plus, Trash2 } from 'lucide-react';
import { api, hasPermission, type Me } from '../lib/api';
import { appPath } from '../lib/navigation';

type Ref = { id: string; name: string; parentId?: string };
type ProductBarcode = { id: string; barcode: string; type: string; isPrimary: boolean };
type BranchConfig = { id: string; branch: Ref; enabled: boolean; cost?: string; salePrice: string; margin: string; stockMinimum: string; posFavorite: boolean; allowManualPrice?: boolean; location?: string; shelf?: string };
type SupplierLink = { id: string; supplierId: string; supplierCode?: string; supplierBarcode?: string; supplierDescription?: string; lastCost?: string; unitsPerCase?: number; minimumOrderQuantity?: string; preferredSupplier: boolean; active: boolean; supplier: Ref };
type Product = { id: string; internalCode: string; name: string; shortName?: string; description?: string; notes?: string; category: Ref; subcategory?: Ref; brand?: Ref; family?: Ref; unitType: string; presentationType?: string; netContent?: string; netContentUnit?: string; taxRate: string; imageUrl?: string; sku?: string; unitsPerCase?: number; caseBarcode?: string; isWeighted: boolean; allowManualPriceDefault: boolean; active: boolean; barcodes: ProductBarcode[]; branchConfigs: BranchConfig[]; supplierProducts: SupplierLink[] };
type StockRow = { productId: string; quantity: number; reservedQuantity: number; availableQuantity: number; saleFloorQuantity: number; warehouseQuantity: number; minimumStock: number };
type HistoryRow = { id: string; createdAt: string; branch?: Ref; changedBy?: { firstName: string; lastName: string }; oldPrice?: string; newPrice?: string; oldCost?: string; newCost?: string; type?: string; quantity?: string; reason?: string };
type SupplierPage = { data: Ref[] };

const tabs = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'sale', label: 'Venta', icon: Boxes },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'suppliers', label: 'Proveedores', icon: Truck },
  { id: 'history', label: 'Historial', icon: History },
] as const;
type Tab = (typeof tabs)[number]['id'];
const money = (value?: string | number) => Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product>();
  const [me, setMe] = useState<Me>();
  const [categories, setCategories] = useState<Ref[]>([]);
  const [brands, setBrands] = useState<Ref[]>([]);
  const [families, setFamilies] = useState<Ref[]>([]);
  const [suppliers, setSuppliers] = useState<Ref[]>([]);
  const [tab, setTab] = useState<Tab>('general');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [stock, setStock] = useState<StockRow>();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const current = await api<Me>('/auth/me');
    const [p, c, b, f] = await Promise.all([
      api<Product>(`/products/${id}`),
      hasPermission(current, 'categories.view') ? api<Ref[]>('/categories') : Promise.resolve([]),
      hasPermission(current, 'brands.view') ? api<Ref[]>('/brands') : Promise.resolve([]),
      api<Ref[]>('/product-families'),
    ]);
    setMe(current); setProduct(p); setCategories(c); setBrands(b); setFamilies(f); setSelectedCategoryId(p.category.id);
    setBranchId((value) => value || p.branchConfigs[0]?.branch.id || '');
  };
  useEffect(() => { void load().catch((e: Error) => setMessage(e.message)); }, [id]);

  useEffect(() => {
    if (!product || !branchId || tab !== 'stock' || !hasPermission(me, 'stock.view')) return;
    void api<StockRow[]>(`/stock?branchId=${branchId}&search=${encodeURIComponent(product.internalCode)}`)
      .then((rows) => setStock(rows.find((row) => row.productId === id)))
      .catch((e: Error) => setMessage(e.message));
  }, [branchId, id, me, product, tab]);

  useEffect(() => {
    if (!product || tab !== 'history') return;
    const requests: Promise<HistoryRow[]>[] = [];
    if (hasPermission(me, 'prices.view')) requests.push(api(`/products/${id}/price-history`));
    if (hasPermission(me, 'costs.view')) requests.push(api(`/products/${id}/cost-history`));
    if (hasPermission(me, 'stock.movements')) requests.push(api<{ data: HistoryRow[] }>(`/stock/movements?productId=${id}`).then((x) => x.data));
    void Promise.all(requests).then((groups) => setHistory(groups.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))).catch((e: Error) => setMessage(e.message));
  }, [id, me, product, tab]);

  const config = useMemo(() => product?.branchConfigs.find((item) => item.branch.id === branchId), [branchId, product]);
  if (!product) return <p className="card p-6">{message || 'Cargando producto…'}</p>;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await action(); await load(); setMessage(success); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(() => api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({
      name: form.get('name'), shortName: form.get('shortName') || undefined, internalCode: form.get('internalCode'),
      categoryId: form.get('categoryId'), subcategoryId: form.get('subcategoryId') || undefined, brandId: form.get('brandId') || undefined,
      familyId: form.get('familyId') || null,
      imageUrl: form.get('imageUrl') || undefined, description: form.get('description') || undefined, notes: form.get('notes') || undefined,
      sku: form.get('sku') || undefined, unitType: form.get('unitType'), presentationType: form.get('presentationType') || undefined,
      netContent: form.get('netContent') || undefined, netContentUnit: form.get('netContentUnit') || undefined,
      unitsPerCase: form.get('unitsPerCase') ? Number(form.get('unitsPerCase')) : undefined, caseBarcode: form.get('caseBarcode') || undefined,
      taxRate: form.get('taxRate'), isWeighted: form.get('isWeighted') === 'on', allowManualPriceDefault: form.get('allowManualPriceDefault') === 'on',
    }) }), 'Datos generales guardados.');
  }

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!branchId) return; const form = new FormData(event.currentTarget);
    await run(() => api(`/products/${id}/branches/${branchId}`, { method: 'PATCH', body: JSON.stringify({
      salePrice: form.get('salePrice'), cost: hasPermission(me, 'costs.update') ? form.get('cost') : undefined,
      queueLabel: true,
      stockMinimum: form.get('stockMinimum'), enabled: form.get('enabled') === 'on', posFavorite: form.get('posFavorite') === 'on',
      allowManualPrice: form.get('allowManualPrice') === 'on', location: form.get('location') || undefined, shelf: form.get('shelf') || undefined,
    }) }), 'Configuración de venta guardada.');
  }

  async function addBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await run(() => api(`/products/${id}/barcodes`, { method: 'POST', body: JSON.stringify({ barcode: form.get('barcode'), type: form.get('type'), isPrimary: form.get('isPrimary') === 'on' }) }), 'Código agregado.');
    event.currentTarget.reset();
  }

  async function linkSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const supplierId = String(form.get('supplierId'));
    await run(() => api(`/suppliers/${supplierId}/products`, { method: 'POST', body: JSON.stringify({ productId: id, supplierCode: form.get('supplierCode') || undefined, supplierBarcode: form.get('supplierBarcode') || undefined, supplierDescription: form.get('supplierDescription') || undefined }) }), 'Proveedor vinculado.');
    event.currentTarget.reset();
  }

  const field = 'mt-2 w-full';
  return <div className="product-editor">
    <a className="text-sm font-semibold text-brand-700" href={appPath('/products')}>← Volver al catálogo</a>
    <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-brand-700">Ficha de producto</p><h1 className="text-3xl font-black">{product.name}</h1><p className="mt-1 font-mono text-sm text-slate-500">{product.internalCode}</p></div>
      <span className="badge">{product.active ? 'Activo' : 'Inactivo'}</span>
    </header>
    {message && <p className="mt-4 rounded-xl bg-brand-50 p-4 text-sm font-semibold text-brand-900">{message}</p>}
    <nav className="product-editor-tabs mt-6" aria-label="Secciones del producto">{tabs.map(({ id: value, label, icon: Icon }) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); if (value === 'suppliers' && suppliers.length === 0) void api<SupplierPage>('/suppliers').then((x) => setSuppliers(x.data)); }}><Icon size={19}/><span>{label}</span></button>)}</nav>

    {tab === 'general' && <form className="card mt-5 p-6" onSubmit={saveGeneral}>
      <div className="mb-6"><h2 className="text-xl font-bold">Información esencial</h2><p className="text-sm text-slate-500">Identidad, presentación y códigos en una sola pantalla.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label>Nombre<input className={field} name="name" defaultValue={product.name} required/></label><label>Nombre corto<input className={field} name="shortName" defaultValue={product.shortName}/></label><label>Código interno<input className={field} name="internalCode" defaultValue={product.internalCode} required/></label>
        <label>Categoría<select className={field} name="categoryId" value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>{categories.filter((x) => !x.parentId).map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Subcategoría<select className={field} name="subcategoryId" key={selectedCategoryId} defaultValue={product.subcategory?.parentId === selectedCategoryId ? product.subcategory.id : ''}><option value="">Sin subcategoría</option>{categories.filter((x) => x.parentId === selectedCategoryId).map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Familia<select className={field} name="familyId" defaultValue={product.family?.id ?? ''}><option value="">Sin familia</option>{families.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Marca (opcional)<select className={field} name="brandId" defaultValue={product.brand?.id ?? ''}><option value="">Sin marca</option>{brands.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
        <label>SKU<input className={field} name="sku" defaultValue={product.sku}/></label><label>Unidad de venta<select className={field} name="unitType" defaultValue={product.unitType}>{['UNIT','KG','GRAM','LITER','METER'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Presentación<select className={field} name="presentationType" defaultValue={product.presentationType ?? ''}><option value="">Sin especificar</option>{['UNIT','BOTTLE','CAN','PACKAGE','BOX','BAG','JAR','SACHET','PACK','TRAY','CASE','OTHER'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Contenido<input className={field} name="netContent" type="number" step="0.001" defaultValue={product.netContent}/></label><label>Unidad de contenido<select className={field} name="netContentUnit" defaultValue={product.netContentUnit ?? ''}><option value="">—</option>{['ML','L','G','KG','UN','M','CM','OTHER'].map((x) => <option key={x}>{x}</option>)}</select></label><label>IVA %<input className={field} name="taxRate" type="number" step="0.01" defaultValue={product.taxRate}/></label>
        <label>Unidades por bulto<input className={field} name="unitsPerCase" type="number" min="1" defaultValue={product.unitsPerCase}/></label><label>Barcode del bulto<input className={field} name="caseBarcode" defaultValue={product.caseBarcode}/></label><label>URL de imagen<input className={field} name="imageUrl" type="url" defaultValue={product.imageUrl}/></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isWeighted" defaultChecked={product.isWeighted}/> Producto pesable</label><label className="flex items-center gap-2"><input type="checkbox" name="allowManualPriceDefault" defaultChecked={product.allowManualPriceDefault}/> Permitir precio manual por defecto</label>
        <label className="md:col-span-2 xl:col-span-3">Descripción<textarea className="mt-2 min-h-20 w-full rounded-xl border p-3" name="description" defaultValue={product.description}/></label><label className="md:col-span-2 xl:col-span-3">Notas internas<textarea className="mt-2 min-h-20 w-full rounded-xl border p-3" name="notes" defaultValue={product.notes}/></label>
      </div>
      {hasPermission(me, 'products.update') && <button className="btn mt-6" disabled={busy}><Save size={17}/>Guardar general</button>}
    </form>}
    {tab === 'general' && <section className="card mt-5 p-6"><h3 className="flex items-center gap-2 font-bold"><Barcode size={19}/>Códigos de barras</h3>{hasPermission(me, 'products.update') && <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={addBarcode}><input name="barcode" required pattern="[0-9]+" placeholder="Código numérico"/><select name="type">{['EAN13','EAN8','UPC','INTERNAL','CASE','OTHER'].map((x) => <option key={x}>{x}</option>)}</select><label className="flex items-center gap-2"><input type="checkbox" name="isPrimary"/> Principal</label><button className="btn-secondary"><Plus size={17}/>Agregar</button></form>}<div className="mt-4 divide-y">{product.barcodes.length === 0 && <p className="py-4 text-sm text-slate-500">Todavía no hay códigos asociados.</p>}{product.barcodes.map((code) => <div className="flex items-center gap-3 py-3" key={code.id}><span className="font-mono">{code.barcode}</span><span className="badge">{code.type}</span>{code.isPrimary && <b className="text-sm">Principal</b>}{hasPermission(me, 'products.update') && <button type="button" aria-label="Eliminar código" className="ml-auto text-red-600" onClick={() => void run(() => api(`/products/${id}/barcodes/${code.id}`, { method: 'DELETE' }), 'Código eliminado.')}><Trash2 size={17}/></button>}</div>)}</div></section>}

    {tab === 'sale' && <section className="card mt-5 p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Venta por sucursal</h2><p className="text-sm text-slate-500">Precio, costo, margen y comportamiento en el POS.</p></div><select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{product.branchConfigs.map((item) => <option key={item.id} value={item.branch.id}>{item.branch.name}</option>)}</select></div>{config ? <form className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={saveSale}><label>Precio de venta<input className={field} name="salePrice" type="number" min="0" step="0.01" defaultValue={config.salePrice} disabled={!hasPermission(me, 'prices.update')}/></label><label>Costo<input className={field} name="cost" type="number" min="0" step="0.01" defaultValue={config.cost} disabled={!hasPermission(me, 'costs.update')}/></label><div className="rounded-xl bg-slate-100 p-4"><span className="text-sm text-slate-500">Margen actual</span><strong className="mt-1 block text-2xl">{config.margin}%</strong></div><label>Stock mínimo<input className={field} name="stockMinimum" type="number" min="0" step="0.001" defaultValue={config.stockMinimum}/></label><label>Ubicación<input className={field} name="location" defaultValue={config.location}/></label><label>Estante<input className={field} name="shelf" defaultValue={config.shelf}/></label><label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={config.enabled}/> Habilitado en la sucursal</label><label className="flex items-center gap-2"><input type="checkbox" name="posFavorite" defaultChecked={config.posFavorite}/> Acceso favorito en POS</label><label className="flex items-center gap-2"><input type="checkbox" name="allowManualPrice" defaultChecked={config.allowManualPrice}/> Permitir precio manual</label>{hasPermission(me, 'products.update') && <button className="btn md:col-span-2 xl:col-span-3" disabled={busy}><Save size={17}/>Guardar venta</button>}</form> : <p className="mt-6 text-slate-500">Este producto todavía no está habilitado en una sucursal.</p>}</section>}

    {tab === 'stock' && <section className="card mt-5 p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Stock disponible</h2><p className="text-sm text-slate-500">Lectura real de local y depósito.</p></div><select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{product.branchConfigs.map((item) => <option key={item.id} value={item.branch.id}>{item.branch.name}</option>)}</select></div>{hasPermission(me, 'stock.view') ? stock ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StockCard label="Local de venta" value={stock.saleFloorQuantity}/><StockCard label="Depósito" value={stock.warehouseQuantity}/><StockCard label="Total" value={stock.quantity}/><StockCard label="Disponible" value={stock.availableQuantity}/></div> : <p className="mt-6 text-slate-500">No hay existencias registradas para esta sucursal.</p> : <p className="mt-6 text-slate-500">Tu rol no tiene permiso para consultar stock.</p>}<p className="mt-5 text-sm text-slate-500">Los ajustes físicos se realizan desde Stock para conservar movimientos y auditoría.</p></section>}

    {tab === 'suppliers' && <section className="card mt-5 p-6"><h2 className="text-xl font-bold">Proveedores del producto</h2><p className="text-sm text-slate-500">Códigos propios de cada proveedor para compras y facturas.</p><div className="mt-5 grid gap-3">{product.supplierProducts.filter((link) => link.active).map((link) => <article className="rounded-xl border p-4" key={link.id}><div className="flex justify-between"><strong>{link.supplier.name}</strong>{link.preferredSupplier && <span className="badge">Preferido</span>}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>Código: <b>{link.supplierCode || '—'}</b></span><span>Barcode: <b>{link.supplierBarcode || '—'}</b></span><span>Último costo: <b>${money(link.lastCost)}</b></span></div></article>)}{product.supplierProducts.length === 0 && <p className="text-sm text-slate-500">Sin proveedores vinculados.</p>}</div>{hasPermission(me, 'suppliers.update') && <form className="mt-6 grid gap-3 border-t pt-6 md:grid-cols-2 xl:grid-cols-3" onSubmit={linkSupplier}><select name="supplierId" required><option value="">Elegir proveedor…</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select><input name="supplierCode" placeholder="Código del proveedor"/><input name="supplierBarcode" placeholder="Barcode del proveedor"/><input name="supplierDescription" placeholder="Descripción en factura"/><button className="btn"><Plus size={17}/>Vincular / actualizar</button></form>}</section>}

    {tab === 'history' && <section className="card mt-5 p-6"><h2 className="text-xl font-bold">Historial operativo</h2><p className="text-sm text-slate-500">Cambios reales de precios, costos y stock. La auditoría técnica ya no ocupa una pestaña vacía.</p><div className="mt-6 divide-y">{history.length === 0 && <p className="py-6 text-slate-500">No hay movimientos visibles con tus permisos.</p>}{history.map((row) => <article className="py-4" key={`${row.id}-${row.createdAt}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{historyTitle(row)}</strong><time className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString('es-AR')}</time></div><p className="mt-1 text-sm text-slate-600">{historyDetail(row)}{row.branch?.name ? ` · ${row.branch.name}` : ''}{row.changedBy ? ` · ${row.changedBy.firstName} ${row.changedBy.lastName}` : ''}</p></article>)}</div></section>}
  </div>;
}

function StockCard({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-slate-950 p-5 text-white"><span className="text-sm text-slate-300">{label}</span><strong className="mt-2 block text-3xl">{value.toLocaleString('es-AR')}</strong></div>; }
function historyTitle(row: HistoryRow) { if (row.newPrice !== undefined) return 'Precio actualizado'; if (row.newCost !== undefined) return 'Costo actualizado'; return 'Movimiento de stock'; }
function historyDetail(row: HistoryRow) { if (row.newPrice !== undefined) return `$${money(row.oldPrice)} → $${money(row.newPrice)}`; if (row.newCost !== undefined) return `$${money(row.oldCost)} → $${money(row.newCost)}`; return `${row.type ?? 'Movimiento'} · ${row.quantity ?? 0} unidades${row.reason ? ` · ${row.reason}` : ''}`; }
