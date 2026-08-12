import { useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { appPath } from '../lib/navigation';
type Order = {
  id: string;
  number: string;
  status: string;
  expectedDate?: string;
  createdAt: string;
  supplier: { name: string };
  branch: { name: string };
  _count: { items: number };
};
export function PurchaseOrders() {
  const [data, setData] = useState<Order[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    api<Order[]>('/purchase-orders')
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-brand-600">COMPRAS</p>
          <h1 className="text-3xl font-bold">Órdenes de compra</h1>
          <p className="text-slate-500">Pedidos enviados y recepción pendiente por proveedor.</p>
        </div>
        <a className="btn-primary" href={appPath('/admin/purchase-orders/new')}>
          <Plus size={18} />
          Nueva orden
        </a>
      </header>
      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {data.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Sucursal</th>
                <th>Items</th>
                <th>Fecha esperada</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((x) => (
                <tr
                  key={x.id}
                  className="cursor-pointer"
                  onClick={() => (location.href = appPath(`/admin/purchase-orders/${x.id}`))}
                >
                  <td className="font-semibold text-brand-600">{x.number}</td>
                  <td>{x.supplier.name}</td>
                  <td>{x.branch.name}</td>
                  <td>{x._count.items}</td>
                  <td>{x.expectedDate ? new Date(x.expectedDate).toLocaleDateString() : '—'}</td>
                  <td>
                    <span className="badge">{x.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <ClipboardList className="text-slate-300" size={40} />
          <div>
            <b>No hay órdenes de compra</b>
            <p className="text-sm text-slate-500">Cree la primera orden para comenzar el circuito de recepción.</p>
          </div>
          <a className="btn-primary" href={appPath('/admin/purchase-orders/new')}>
            Crear orden
          </a>
        </div>
      )}
    </div>
  );
}
