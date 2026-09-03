import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Barcode, Boxes, Camera, ChevronLeft, PackagePlus, Search, Tags } from 'lucide-react';
import { api, hasPermission, type Me } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { API } from '../lib/api';
import { appPath } from '../lib/navigation';
import { resolveMobileBranchId, setDesktopAdminPreference } from '../lib/mobile-admin';
import type { IScannerControls } from '@zxing/browser';

type Branch = { id: string; name: string };
type Ref = { id: string; name: string; parentId?: string };
type Config = { branch: Branch; salePrice: string; cost?: string; stockMinimum: string };
type Product = { id: string; name: string; internalCode: string; imageUrl?: string; category: Ref; barcodes: { barcode: string }[]; branchConfigs: Config[] };
type ProductPage = { data: Product[] };
type Stock = { productId: string; quantity: number; availableQuantity: number; saleFloorQuantity: number; warehouseQuantity: number };
type View = 'home' | 'scan' | 'search' | 'product' | 'price' | 'stock' | 'create';
const cash = (value?: string | number) => Number(value ?? 0).toLocaleString('es-AR');
export function MobileAdmin({ me, branches, initialBranchId }: { me: Me; branches: Branch[]; initialBranchId?: string }) {
  const [view, setView] = useState<View>('home'), [branchId, setBranchId] = useState(initialBranchId ?? branches[0]?.id ?? '');
  const [product, setProduct] = useState<Product>(), [stock, setStock] = useState<Stock>(), [barcode, setBarcode] = useState('');
  const [query, setQuery] = useState(''), [results, setResults] = useState<Product[]>([]), [categories, setCategories] = useState<Ref[]>([]), [suppliers, setSuppliers] = useState<Ref[]>([]);
  const [message, setMessage] = useState(''), [priceMode, setPriceMode] = useState(false), [cameraActive, setCameraActive] = useState(false), [searching, setSearching] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null), scannerRef = useRef<IScannerControls | undefined>(undefined), scannedRef = useRef(false);
  const config = product?.branchConfigs.find((item) => item.branch.id === branchId);

  useEffect(() => { branchContext.set(branchId); }, [branchId]);
  useEffect(() => { setBranchId((current) => resolveMobileBranchId(current, initialBranchId, branches)); }, [branches, initialBranchId]);
  useEffect(() => { if (view === 'create' && !categories.length) void Promise.all([api<Ref[]>('/categories'), hasPermission(me, 'suppliers.view') ? api<{ data: Ref[] }>('/suppliers').then((x) => x.data) : Promise.resolve([])]).then(([c, s]) => { setCategories(c); setSuppliers(s); }); }, [categories.length, me, view]);
  useEffect(() => { const timer = window.setTimeout(() => { if (view === 'search' && query.trim().length >= 2) void api<ProductPage>(`/products?branchId=${branchId}&search=${encodeURIComponent(query)}&limit=12`).then((x) => setResults(x.data)); }, 350); return () => clearTimeout(timer); }, [branchId, query, view]);
  useEffect(() => () => stopCamera(), []);

  async function lookup(code: string) {
    const normalized = code.trim();
    if (!normalized) { setMessage('Ingresá o escaneá un código.'); scannedRef.current = false; return; }
    if (!branchId) { setMessage('Esperando la sucursal habilitada. Intentá nuevamente en un momento.'); scannedRef.current = false; return; }
    stopCamera(); setSearching(true); setMessage('Buscando producto…');
    try {
      const page = await api<ProductPage>(`/products?branchId=${branchId}&search=${encodeURIComponent(normalized)}&limit=10`, { signal: AbortSignal.timeout(12000) });
      const found = page.data.find((item) => item.barcodes.some((entry) => entry.barcode === normalized));
      if (!found) { setBarcode(normalized); setProduct(undefined); setMessage('Producto no encontrado'); setView('create'); navigator.vibrate?.([80, 50, 80]); return; }
      await openProduct(found); navigator.vibrate?.(60);
    } catch (error) {
      setMessage((error as Error).name === 'TimeoutError' ? 'La búsqueda tardó demasiado. Revisá la conexión y volvé a intentar.' : (error as Error).message);
      setView('scan'); scannedRef.current = false;
    } finally { setSearching(false); }
  }
  async function openProduct(found: Product) {
    setProduct(found); setMessage(''); setView('product');
    if (hasPermission(me, 'stock.view')) {
      try { const rows = await api<Stock[]>(`/stock?branchId=${branchId}&search=${encodeURIComponent(found.internalCode)}`); setStock(rows.find((row) => row.productId === found.id)); }
      catch { setStock(undefined); setMessage('Producto encontrado. No se pudo cargar el stock en este momento.'); }
    }
  }
  async function startCamera() {
    setView('scan'); setMessage(''); scannedRef.current = false;
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!videoRef.current) return;
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      scannerRef.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, videoRef.current, (result) => {
        if (!result || scannedRef.current) return;
        scannedRef.current = true; void lookup(result.getText());
      });
      setCameraActive(true);
    } catch { setMessage('No se pudo abrir la cámara. Podés ingresar el código manualmente.'); }
  }
  function stopCamera() { scannerRef.current?.stop(); scannerRef.current = undefined; setCameraActive(false); }
  function nextScan() { setProduct(undefined); setStock(undefined); setBarcode(''); setMessage(''); void startCamera(); }

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!product || !config || !hasPermission(me, 'prices.update')) return; const data = new FormData(event.currentTarget), next = String(data.get('price'));
    await api(`/products/${product.id}/branches/${branchId}`, { method: 'PATCH', body: JSON.stringify({ salePrice: next, queueLabel: true }) });
    setMessage(`$${cash(config.salePrice)} → $${cash(next)} · etiqueta pendiente`);
    if (priceMode) window.setTimeout(nextScan, 700); else await openProduct({ ...product, branchConfigs: product.branchConfigs.map((c) => c.branch.id === branchId ? { ...c, salePrice: next } : c) });
  }
  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!product) return; const form = new FormData(event.currentTarget), location = String(form.get('location'));
    await api('/stock/adjust', { method: 'POST', body: JSON.stringify({ branchId, productId: product.id, mode: 'SET', quantity: Number(form.get('quantity')), reason: 'Ajuste desde administración móvil', location }) });
    setMessage('Stock actualizado correctamente.'); await openProduct(product);
  }
  async function replenish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!product) return; const quantity = Number(new FormData(event.currentTarget).get('quantity'));
    const next = await api<{ saleFloorQuantity: number; warehouseQuantity: number }>('/stock/replenish', { method: 'POST', body: JSON.stringify({ branchId, productId: product.id, quantity }) });
    setStock((old) => old && ({ ...old, saleFloorQuantity: next.saleFloorQuantity, warehouseQuantity: next.warehouseQuantity })); setMessage('Reposición realizada sin cambiar el stock total.');
  }
  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); let imageUrl: string | undefined; const photo = form.get('photo');
    if (photo instanceof File && photo.size) { const upload = new FormData(); upload.append('file', photo); imageUrl = (await api<{ url: string }>('/products/image', { method: 'POST', body: upload })).url; }
    const created = await api<Product>('/products', { method: 'POST', body: JSON.stringify({ name: form.get('name'), barcode: form.get('barcode'), categoryId: form.get('categoryId'), imageUrl, branchConfig: { branchId, salePrice: String(form.get('price')), cost: hasPermission(me, 'costs.update') ? String(form.get('cost') || 0) : undefined, saleFloorStock: String(form.get('stock') || 0), warehouseStock: '0', enabled: true } }) });
    const supplierId = String(form.get('supplierId') || ''); if (supplierId) await api(`/suppliers/${supplierId}/products`, { method: 'POST', body: JSON.stringify({ productId: created.id }) });
    setMessage('Producto creado. Listo para el siguiente código.'); window.setTimeout(nextScan, 700);
  }

  return <main className="mobile-admin">
    <header><div><small>ADMIN MÓVIL</small><b>{me.company.name}</b></div><button onClick={() => { setDesktopAdminPreference(true); location.href = appPath('/admin'); }}>Ver versión de escritorio</button></header>
    <section className="mobile-admin-context"><select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><span>{me.user.firstName} {me.user.lastName}</span></section>
    {view !== 'home' && <button className="mobile-back" onClick={() => { stopCamera(); setView('home'); }}><ChevronLeft/>Inicio</button>}
    {message && <div className="mobile-message">{searching && <span className="mobile-spinner"/>}{message}</div>}
    {view === 'home' && <section className="mobile-actions">
      <Action icon={Camera} title="Escanear producto" onClick={() => void startCamera()}/><Action icon={Search} title="Buscar producto" onClick={() => setView('search')}/>
      {hasPermission(me, 'products.create') && hasPermission(me, 'prices.update') && <Action icon={PackagePlus} title="Crear producto" onClick={() => { setBarcode(''); setView('create'); }}/>} {hasPermission(me, 'prices.update') && <Action icon={Barcode} title="Cambio rápido de precios" onClick={() => { setPriceMode(true); void startCamera(); }}/>} 
      {hasPermission(me, 'stock.view') && <Action icon={Boxes} title="Control de stock" onClick={() => setView('search')}/>} {hasPermission(me, 'labels.view') && <a className="mobile-action" href={appPath('/labels')}><Tags/><b>Etiquetas pendientes</b></a>}
    </section>}
    {view === 'scan' && <section className="mobile-scanner"><div className="scanner-frame"><video ref={videoRef} muted playsInline/>{!cameraActive && <Barcode size={70}/>}<i/></div><p>Apuntá al código de barras. La cámara trasera se selecciona automáticamente.</p><form onSubmit={(e) => { e.preventDefault(); void lookup(String(new FormData(e.currentTarget).get('barcode'))); }}><input name="barcode" inputMode="numeric" autoFocus placeholder="Ingresar código" disabled={searching}/><button className="mobile-primary" disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button></form></section>}
    {view === 'search' && <section><label className="mobile-search"><Search/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, código o barcode"/></label><div className="mobile-results">{results.map((item) => <button key={item.id} onClick={() => void openProduct(item)}><b>{item.name}</b><small>{item.internalCode} · {item.barcodes[0]?.barcode}</small></button>)}</div></section>}
    {view === 'product' && product && <ProductCard product={product} config={config} stock={stock} me={me} onPrice={() => setView('price')} onStock={() => setView('stock')} onNext={nextScan}/>} 
    {view === 'price' && product && config && <section className="mobile-form"><h1>Nuevo precio</h1><p>{product.name}</p><div className="price-before">Actual: <b>${cash(config.salePrice)}</b></div><form onSubmit={savePrice}><label>Nuevo precio<input name="price" type="number" inputMode="decimal" min="0" step="0.01" autoFocus required/></label><button className="mobile-primary">Guardar {priceMode ? 'y siguiente' : 'precio'}</button></form></section>}
    {view === 'stock' && product && <section className="mobile-form"><h1>Stock</h1><p>{product.name}</p><div className="stock-pills"><b>Local {stock?.saleFloorQuantity ?? 0}</b><b>Depósito {stock?.warehouseQuantity ?? 0}</b></div>{hasPermission(me, 'stock.adjust') && <><form onSubmit={saveStock}><select name="location"><option value="SALE_FLOOR">Local de venta</option><option value="WAREHOUSE">Depósito</option></select><input name="quantity" type="number" inputMode="decimal" min="0" step="0.001" placeholder="Cantidad final" required/><button className="mobile-primary">Guardar stock</button></form>{(stock?.warehouseQuantity ?? 0) > 0 && <form className="replenish" onSubmit={replenish}><h2><ArrowLeftRight/> Reponer local</h2><input name="quantity" type="number" inputMode="decimal" min="0.001" max={stock?.warehouseQuantity} step="0.001" placeholder="Cantidad a mover" required/><button>Depósito → Local</button></form>}</>}</section>}
    {view === 'create' && <section className="mobile-form"><h1>{barcode ? 'Producto no encontrado' : 'Crear producto rápido'}</h1><p>Completá sólo lo necesario. Podrás editar el resto después.</p>{hasPermission(me, 'products.create') && hasPermission(me, 'prices.update') ? <form onSubmit={createProduct}><label>Nombre<input name="name" required autoFocus/></label><label>Barcode<input name="barcode" inputMode="numeric" defaultValue={barcode} required/></label><label>Categoría<select name="categoryId" required><option value="">Elegir…</option>{categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Precio<input name="price" type="number" inputMode="decimal" min="0" step="0.01" required/></label>{hasPermission(me, 'costs.update') && <label>Costo<input name="cost" type="number" inputMode="decimal" min="0" step="0.01"/></label>}<label>Stock inicial local<input name="stock" type="number" inputMode="decimal" min="0" step="0.001"/></label>{suppliers.length > 0 && <label>Proveedor opcional<select name="supplierId"><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}<label>Foto opcional<input name="photo" type="file" accept="image/*" capture="environment"/></label><button className="mobile-primary">Crear y seguir escaneando</button></form> : <p>Tu rol necesita permisos para crear productos y modificar precios.</p>}</section>}
  </main>;
}

function Action({ icon: Icon, title, onClick }: { icon: typeof Camera; title: string; onClick: () => void }) { return <button className="mobile-action" onClick={onClick}><Icon/><b>{title}</b></button>; }
function ProductCard({ product, config, stock, me, onPrice, onStock, onNext }: { product: Product; config?: Config; stock?: Stock; me: Me; onPrice(): void; onStock(): void; onNext(): void }) { return <section className="mobile-product"><div className="mobile-product-photo">{product.imageUrl ? <img src={product.imageUrl.startsWith('/api/') ? `${API}${product.imageUrl.slice(4)}` : product.imageUrl}/> : <Boxes/>}</div><h1>{product.name}</h1><p>{product.barcodes[0]?.barcode || product.internalCode}</p><dl><div><dt>Precio</dt><dd>${cash(config?.salePrice)}</dd></div>{hasPermission(me, 'costs.view') && <div><dt>Costo</dt><dd>${cash(config?.cost)}</dd></div>}<div><dt>Local</dt><dd>{stock?.saleFloorQuantity ?? '—'}</dd></div><div><dt>Depósito</dt><dd>{stock?.warehouseQuantity ?? '—'}</dd></div></dl><div className="mobile-product-buttons">{hasPermission(me, 'prices.update') && <button onClick={onPrice}>PRECIO</button>}{hasPermission(me, 'stock.view') && <button onClick={onStock}>STOCK</button>}<a href={appPath(`/products/${product.id}`)}>EDITAR</a>{hasPermission(me, 'labels.generate') && <a href={appPath('/labels')}>ETIQUETA</a>}</div><button className="mobile-primary" onClick={onNext}><Camera/>Escanear siguiente</button></section>; }
