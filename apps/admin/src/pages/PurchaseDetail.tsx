import { useEffect, useState } from 'react';
import { api } from '../lib/api';
type Purchase = {
  invoiceNumber?: string;
  invoiceType?: string;
  invoiceDate: string;
  receivedDate: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  otherCharges: string;
  total: string;
  notes?: string;
  supplier: { name: string };
  branch: { name: string };
  createdBy: { firstName: string; lastName: string };
  items: {
    id: string;
    descriptionSnapshot: string;
    packagesQuantity: string;
    unitsPerCase?: number;
    totalUnits: string;
    unitCost: string;
    total: string;
    product: { internalCode: string; name: string };
  }[];
  documents: { id: string; originalName: string; status: string }[];
};
export function PurchaseDetail({ id }: { id: string }) {
  const [data, setData] = useState<Purchase>(),
    [error, setError] = useState('');
  useEffect(() => {
    api<Purchase>(`/purchases/${id}`)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [id]);
  if (!data) return <div className="card p-6">{error || 'Cargando compra…'}</div>;
  return (
    <div className="space-y-5">
      <header>
        <a href="../purchases" className="text-sm text-brand-600">
          ← Compras
        </a>
        <h1 className="text-3xl font-bold">
          {data.invoiceType || 'Comprobante'} {data.invoiceNumber || 'sin número'}
        </h1>
        <p>
          {data.supplier.name} · {data.branch.name}
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Estado', data.status],
          ['Fecha', new Date(data.invoiceDate).toLocaleDateString()],
          ['Items', data.items.length],
          ['Total', `$${Number(data.total).toLocaleString('es-AR')}`],
        ].map(([a, b]) => (
          <div className="card p-4" key={a}>
            <small>{a}</small>
            <b className="mt-1 block text-xl">{b}</b>
          </div>
        ))}
      </section>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Bultos</th>
              <th>Unidades</th>
              <th>Costo</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((x) => (
              <tr key={x.id}>
                <td>
                  <b>{x.product.name}</b>
                  <small className="block">{x.product.internalCode}</small>
                </td>
                <td>{x.packagesQuantity}</td>
                <td>{x.totalUnits}</td>
                <td>${x.unitCost}</td>
                <td>${x.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
