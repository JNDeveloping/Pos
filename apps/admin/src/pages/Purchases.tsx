import { useEffect, useState } from 'react';
import { FileUp, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { appPath } from '../lib/navigation';
type Purchase = {
  id: string;
  invoiceNumber?: string;
  invoiceDate: string;
  total: string;
  status: string;
  supplier: { name: string };
  branch: { name: string };
  _count: { items: number; documents: number };
};
export function Purchases() {
  const [data, setData] = useState<Purchase[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    api<{ data: Purchase[] }>('/purchases')
      .then((x) => setData(x.data))
      .catch((e) => setError(String(e)));
  }, []);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compras y recepción</h1>
          <p className="text-slate-500">Borrador → revisión → confirmación humana.</p>
        </div>
        <div className="flex gap-2">
          <a className="btn-primary" href={appPath('/admin/invoices/analyze')}>
            <FileUp size={18} /> Importar factura
          </a>
          <a className="btn-secondary" href={appPath('/admin/purchases/new')}>
            <Plus size={18} /> Carga manual
          </a>
        </div>
      </header>
      {error && <div className="rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
      {!data.length && !error ? (
        <div className="card p-10 text-center">
          <b>No hay compras registradas</b>
          <p className="mt-1 text-sm text-slate-500">Cargue una factura o registre una compra manual.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Items</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((x) => (
                <tr
                  key={x.id}
                  className="cursor-pointer"
                  onClick={() => (location.href = appPath(`/admin/purchases/${x.id}`))}
                >
                  <td>{x.invoiceNumber || 'Sin número'}</td>
                  <td>{x.supplier.name}</td>
                  <td>{new Date(x.invoiceDate).toLocaleDateString()}</td>
                  <td>{x.branch.name}</td>
                  <td>{x._count.items}</td>
                  <td>${Number(x.total).toLocaleString('es-AR')}</td>
                  <td>
                    <span className="badge">{x.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
