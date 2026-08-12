import { useEffect, useState } from 'react';
import { api } from '../lib/api';
type Order = {
  number: string;
  status: string;
  notes?: string;
  expectedDate?: string;
  supplier: { name: string };
  branch: { name: string };
  items: {
    id: string;
    quantity: string;
    receivedQuantity: string;
    unitCost: string;
    subtotal: string;
    product: { internalCode: string; name: string };
  }[];
};
export function PurchaseOrderDetail({ id }: { id: string }) {
  const [data, setData] = useState<Order>(),
    [error, setError] = useState('');
  useEffect(() => {
    api<Order>(`/purchase-orders/${id}`)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [id]);
  if (!data) return <div className="card p-6">{error || 'Cargando orden…'}</div>;
  return (
    <div className="space-y-5">
      <header>
        <a href="../purchase-orders" className="text-sm text-brand-600">
          ← Órdenes
        </a>
        <h1 className="text-3xl font-bold">{data.number}</h1>
        <p>
          {data.supplier.name} · {data.branch.name}
        </p>
      </header>
      <div className="card p-5">
        <span className="badge">{data.status}</span>
        {data.notes && <p className="mt-3">{data.notes}</p>}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Pedido</th>
              <th>Recibido</th>
              <th>Costo</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((x) => (
              <tr key={x.id}>
                <td>
                  {x.product.internalCode} · {x.product.name}
                </td>
                <td>{x.quantity}</td>
                <td>{x.receivedQuantity}</td>
                <td>${x.unitCost}</td>
                <td>${x.subtotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
