import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { appPath, navigate } from '../lib/navigation';
type Option = { id: string; name: string };
type Product = { id: string; name: string; internalCode: string };
type Item = {
  productId: string;
  descriptionSnapshot: string;
  packagesQuantity: string;
  unitsPerCase: string;
  totalUnits: string;
  unitCost: string;
};
export function PurchaseNew() {
  const [suppliers, setSuppliers] = useState<Option[]>([]),
    [branches, setBranches] = useState<Option[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [productSearch, setProductSearch] = useState(''), [busy, setBusy] = useState(false),
    [items, setItems] = useState<Item[]>([
      {
        productId: '',
        descriptionSnapshot: '',
        packagesQuantity: '1',
        unitsPerCase: '1',
        totalUnits: '1',
        unitCost: '0',
      },
    ]),
    [error, setError] = useState('');
  useEffect(() => {
    void Promise.all([
      api<{ data: Option[] }>('/suppliers'),
      api<Option[]>('/branches'),
    ])
      .then(([s, b]) => {
        setSuppliers(s.data);
        setBranches(b);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (productSearch.trim().length < 2) { setProducts([]); return; }
    const timer = window.setTimeout(() => void api<{ data: Product[] }>(`/products?limit=30&search=${encodeURIComponent(productSearch.trim())}`).then((result) => setProducts(result.data)).catch((e: Error) => setError(e.message)), 250);
    return () => window.clearTimeout(timer);
  }, [productSearch]);
  function update(index: number, patch: Partial<Item>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (busy) return;
    setBusy(true);
    try {
      await api('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: f.get('supplierId'),
          branchId: f.get('branchId'),
          invoiceType: f.get('invoiceType') || undefined,
          invoiceNumber: f.get('invoiceNumber') || undefined,
          invoiceDate: f.get('invoiceDate'),
          receivedDate: f.get('receivedDate') || undefined,
          notes: f.get('notes') || undefined,
          items: items
            .filter((x) => x.productId)
            .map((x) => ({ ...x, unitsPerCase: Number(x.unitsPerCase) || undefined })),
        }),
      });
      navigate('/admin/purchases');
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="space-y-5" onSubmit={submit}>
      <header>
        <a href={appPath('/admin/purchases')} className="text-sm text-brand-600">
          ← Compras
        </a>
        <h1 className="mt-2 text-3xl font-bold">Carga manual de compra</h1>
        <p className="text-slate-500">La compra quedará en revisión hasta que un usuario autorizado la confirme.</p>
      </header>
      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      <section className="card grid gap-4 p-5 md:grid-cols-3">
        <label>
          Proveedor
          <select required name="supplierId">
            <option value="">Seleccionar</option>
            {suppliers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sucursal
          <select required name="branchId">
            <option value="">Seleccionar</option>
            {branches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <input name="invoiceType" placeholder="A, B, C…" />
        </label>
        <label>
          Número
          <input name="invoiceNumber" />
        </label>
        <label>
          Fecha factura
          <input required type="date" name="invoiceDate" />
        </label>
        <label>
          Fecha recepción
          <input type="date" name="receivedDate" />
        </label>
        <label className="md:col-span-3">
          Notas
          <input className="w-full" name="notes" />
        </label>
      </section>
      <section className="card p-5">
        <div className="mb-4 flex justify-between">
          <h2 className="font-bold">Items recibidos</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setItems([
                ...items,
                {
                  productId: '',
                  descriptionSnapshot: '',
                  packagesQuantity: '1',
                  unitsPerCase: '1',
                  totalUnits: '1',
                  unitCost: '0',
                },
              ])
            }
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">Buscar producto<input className="mt-2 w-full" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nombre, código interno, SKU o barcode (mínimo 2 caracteres)"/></label>
          {items.map((item, index) => (
            <div
              className="grid gap-3 rounded-xl bg-slate-50 p-3 lg:grid-cols-[1fr_100px_100px_120px_140px_44px]"
              key={index}
            >
              <select
                required
                value={item.productId}
                onChange={(e) => {
                  const product = products.find((x) => x.id === e.target.value);
                  update(index, { productId: e.target.value, descriptionSnapshot: product?.name ?? '' });
                }}
              >
                <option value="">Producto</option>
                {products.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.internalCode} · {x.name}
                  </option>
                ))}
              </select>
              <input
                title="Bultos"
                type="number"
                min="0"
                step="0.001"
                value={item.packagesQuantity}
                onChange={(e) => update(index, { packagesQuantity: e.target.value })}
              />
              <input
                title="Unidades/bulto"
                type="number"
                min="1"
                value={item.unitsPerCase}
                onChange={(e) =>
                  update(index, {
                    unitsPerCase: e.target.value,
                    totalUnits: String(Number(item.packagesQuantity) * Number(e.target.value)),
                  })
                }
              />
              <input
                title="Unidades totales"
                type="number"
                min="0.001"
                step="0.001"
                value={item.totalUnits}
                onChange={(e) => update(index, { totalUnits: e.target.value })}
              />
              <input
                title="Costo unitario"
                type="number"
                min="0"
                step="0.01"
                value={item.unitCost}
                onChange={(e) => update(index, { unitCost: e.target.value })}
              />
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy || !items.some((item) => item.productId)}>{busy ? 'Guardando…' : 'Guardar para revisión'}</button>
      </div>
    </form>
  );
}
