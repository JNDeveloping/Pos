import { useEffect, useState } from 'react';
import { Printer, RotateCcw, XCircle } from 'lucide-react';
import { api, type Me, hasPermission } from '../lib/api';

export function SaleDetail({ id, me }: { id: string; me: Me }) {
  const [sale, setSale] = useState<any>();
  const load = () => api(`/sales/${id}`).then(setSale);
  useEffect(() => void load(), [id]);
  if (!sale) return <div className="card p-8">Cargando venta…</div>;
  return (
    <div className="space-y-5">
      <header className="page-heading">
        <div>
          <p className="eyebrow">VENTA</p>
          <h1>{sale.saleNumber}</h1>
          <p>
            {new Date(sale.createdAt).toLocaleString('es-AR')} · {sale.status}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={async () => {
              const ticket = await api(`/sales/${id}/reprint`, { method: 'POST' });
              setSale(ticket);
              setTimeout(() => window.print());
            }}
            disabled={!hasPermission(me, 'sales.reprintTicket')}
          >
            <Printer /> Reimprimir
          </button>
          <button
            className="btn-secondary"
            disabled={!hasPermission(me, 'sales.return')}
            onClick={async () => {
              const first = sale.items[0];
              if (!first) return;
              const quantity = Number(prompt(`Cantidad a devolver de ${first.productNameSnapshot}`));
              if (quantity > 0) {
                await api(`/sales/${id}/returns`, {
                  method: 'POST',
                  body: JSON.stringify({
                    reason: 'Devolución desde ficha de venta',
                    items: [{ saleItemId: first.id, quantity, returnToStock: true }],
                  }),
                });
                await load();
              }
            }}
          >
            <RotateCcw /> Devolver
          </button>
          <button
            className="btn-secondary text-red-600"
            disabled={!hasPermission(me, 'sales.cancel')}
            onClick={async () => {
              const reason = prompt('Motivo de anulación');
              if (reason) {
                await api(`/sales/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
                await load();
              }
            }}
          >
            <XCircle /> Anular
          </button>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((x: any) => (
                  <tr key={x.id}>
                    <td>{x.productNameSnapshot}</td>
                    <td>{x.quantity}</td>
                    <td>${Number(x.unitPrice).toLocaleString('es-AR')}</td>
                    <td>${Number(x.subtotal).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="card p-5">
          <h2>Pagos</h2>
          {sale.payments.map((x: any) => (
            <div className="flex justify-between border-b py-3" key={x.id}>
              <span>{x.paymentMethod.name}</span>
              <b>${Number(x.amount).toLocaleString('es-AR')}</b>
            </div>
          ))}
          <div className="mt-5 flex justify-between text-2xl">
            <span>Total</span>
            <b>${Number(sale.total).toLocaleString('es-AR')}</b>
          </div>
        </aside>
      </div>
    </div>
  );
}
