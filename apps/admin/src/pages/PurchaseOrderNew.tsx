import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { appPath } from '../lib/navigation';
type Option = { id: string; name: string; code?: string };
type Product = { id: string; name: string; internalCode: string };
export function PurchaseOrderNew() {
  const [suppliers, setSuppliers] = useState<Option[]>([]),
    [branches, setBranches] = useState<Option[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [items, setItems] = useState([{ productId: '', quantity: '1', unitCost: '0' }]),
    [error, setError] = useState('');
  useEffect(() => {
    void Promise.all([
      api<{ data: Option[] }>('/suppliers'),
      api<Option[]>('/branches'),
      api<{ data: Product[] }>('/products?limit=100'),
    ])
      .then(([s, b, p]) => {
        setSuppliers(s.data);
        setBranches(b);
        setProducts(p.data);
      })
      .catch((e) => setError(String(e)));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: f.get('supplierId'),
          branchId: f.get('branchId'),
          expectedDate: f.get('expectedDate') || undefined,
          notes: f.get('notes') || undefined,
          items: items.filter((x) => x.productId).map((x) => ({ ...x })),
        }),
      });
      location.href = appPath('/admin/purchase-orders');
    } catch (x) {
      setError(String(x));
    }
  }
  return (
    <form className="space-y-5" onSubmit={submit}>
      <header>
        <a href={appPath('/admin/purchase-orders')} className="text-sm text-brand-600">
          ← Órdenes
        </a>
        <h1 className="mt-2 text-3xl font-bold">Nueva orden de compra</h1>
      </header>
      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      <section className="card grid gap-4 p-5 md:grid-cols-3">
        <label>
          Proveedor
          <select name="supplierId" required>
            <option value="">Seleccionar</option>
            {suppliers.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sucursal
          <select name="branchId" required>
            <option value="">Seleccionar</option>
            {branches.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha esperada
          <input type="date" name="expectedDate" />
        </label>
        <label className="md:col-span-3">
          Observaciones
          <input className="w-full" name="notes" />
        </label>
      </section>
      <section className="card p-5">
        <div className="mb-4 flex justify-between">
          <h2 className="font-bold">Productos solicitados</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setItems([...items, { productId: '', quantity: '1', unitCost: '0' }])}
          >
            <Plus size={16} />
            Agregar línea
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_140px_160px_44px]" key={index}>
              <select
                value={item.productId}
                required
                onChange={(e) => setItems(items.map((x, i) => (i === index ? { ...x, productId: e.target.value } : x)))}
              >
                <option value="">Producto</option>
                {products.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.internalCode} · {x.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={item.quantity}
                onChange={(e) => setItems(items.map((x, i) => (i === index ? { ...x, quantity: e.target.value } : x)))}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitCost}
                onChange={(e) => setItems(items.map((x, i) => (i === index ? { ...x, unitCost: e.target.value } : x)))}
              />
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="flex justify-end">
        <button className="btn-primary">Guardar orden</button>
      </div>
    </form>
  );
}
