import { useEffect, useState } from 'react';
import { api } from '../lib/api';
type Supplier = {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  cuit?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  paymentTerms?: string;
  visitDays?: string;
  notes?: string;
  products: {
    id: string;
    supplierCode?: string;
    supplierDescription?: string;
    lastCost?: string;
    product: { name: string; internalCode: string };
  }[];
  _count: { purchases: number; purchaseOrders: number };
};
export function SupplierDetail({ id }: { id: string }) {
  const [data, setData] = useState<Supplier>(),
    [tab, setTab] = useState('GENERAL'),
    [message, setMessage] = useState('');
  useEffect(() => {
    api<Supplier>(`/suppliers/${id}`)
      .then(setData)
      .catch((e) => setMessage(String(e)));
  }, [id]);
  if (!data) return <div className="card p-6">{message || 'Cargando proveedor…'}</div>;
  const tabs = ['GENERAL', 'CONTACTO', 'PRODUCTOS', 'COMPRAS', 'FACTURAS', 'CUENTA FUTURA', 'AUDITORÍA'];
  return (
    <div className="space-y-5">
      <header>
        <a href="../suppliers" className="text-sm text-brand-700">
          ← Proveedores
        </a>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p>
          {data.code} · {data.cuit || 'CUIT no informado'}
        </p>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((x) => (
          <button className={tab === x ? 'btn-primary' : ''} onClick={() => setTab(x)} key={x}>
            {x}
          </button>
        ))}
      </div>
      {tab === 'PRODUCTOS' ? (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Código proveedor</th>
                <th>Producto catálogo</th>
                <th>Descripción proveedor</th>
                <th>Último costo</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((x) => (
                <tr key={x.id}>
                  <td>{x.supplierCode || '—'}</td>
                  <td>
                    {x.product.internalCode} · {x.product.name}
                  </td>
                  <td>{x.supplierDescription || '—'}</td>
                  <td>{x.lastCost ? `$${x.lastCost}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'CUENTA FUTURA' ? (
        <div className="card p-6">
          <b>Cuenta corriente no implementada en esta etapa.</b>
          <p className="text-slate-500">El espacio queda reservado sin inventar saldos.</p>
        </div>
      ) : (
        <div className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data)
            .filter(([, v]) => typeof v === 'string' && v)
            .map(([k, v]) => (
              <div key={k}>
                <small className="uppercase text-slate-500">{k}</small>
                <p>{String(v)}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
