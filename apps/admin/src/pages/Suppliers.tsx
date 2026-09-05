import { useEffect, useState } from 'react';
import { Plus, Search, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { appPath } from '../lib/navigation';
type Supplier = {
  id: string;
  code: string;
  name: string;
  cuit?: string;
  phone?: string;
  email?: string;
  active: boolean;
  _count: { products: number; purchases: number };
};
export function Suppliers() {
  const [data, setData] = useState<Supplier[]>([]),
    [search, setSearch] = useState(''),
    [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        api<{ data: Supplier[] }>(`/suppliers?search=${encodeURIComponent(search)}`)
          .then((x) => setData(x.data))
          .catch((e: Error) => setError(e.message)),
      250,
    );
    return () => clearTimeout(timer);
  }, [search, refresh]);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-slate-500">Contactos, productos vinculados y compras históricas.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={18} /> Nuevo proveedor
        </button>
      </header>
      {error && <div className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
      <div className="card p-4">
        <label className="flex items-center gap-2">
          <Search size={18} />
          <input
            className="w-full border-0"
            placeholder="Nombre, código o CUIT"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-3">
        {data.map((x) => (
          <a
            className="card grid gap-2 p-4 hover:border-brand-400 md:grid-cols-[120px_1fr_180px_180px]"
            href={appPath(`/admin/suppliers/${x.id}`)}
            key={x.id}
          >
            <b>{x.code}</b>
            <span>
              <b>{x.name}</b>
              <small className="block text-slate-500">{x.cuit || 'CUIT no informado'}</small>
            </span>
            <span>{x._count.products} productos</span>
            <span>{x._count.purchases} compras</span>
          </a>
        ))}
        {!data.length && (
          <div className="card grid place-items-center p-10 text-slate-500">
            <Truck />
            No hay proveedores.
          </div>
        )}
      </div>
      {open && (
        <SupplierModal
          close={() => setOpen(false)}
          saved={() => {
            setOpen(false);
            setRefresh((x) => x + 1);
          }}
        />
      )}
    </div>
  );
}
function SupplierModal({ close, saved }: { close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ name: '', legalName: '', cuit: '', phone: '', whatsapp: '', email: '', notes: '' }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/suppliers', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(Object.entries(form).filter(([, v]) => v))),
      });
      saved();
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <form className="card w-full max-w-2xl space-y-4 p-6" onSubmit={submit}>
        <h2 className="text-xl font-bold">Nuevo proveedor</h2>
        {error && <p className="text-red-600">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(form).map(([k, v]) => (
            <label key={k} className="text-sm">
              {{ name: 'Nombre *', legalName: 'Razón social', cuit: 'CUIT', phone: 'Teléfono', whatsapp: 'WhatsApp', email: 'Email', notes: 'Observaciones' }[k]}
              <input required={k === 'name'} value={v} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
