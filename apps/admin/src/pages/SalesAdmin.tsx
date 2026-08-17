import { useEffect, useState } from 'react';
import { api } from '../lib/api';
export function SalesAdmin({ kind }: { kind: 'sales' | 'payment-methods' | 'terminals' }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void api<any[]>(kind === 'sales' ? '/sales' : `/${kind}`).then(setRows);
  }, [kind]);
  return (
    <div className="space-y-5">
      <header className="page-heading">
        <div>
          <p className="eyebrow">VENTAS</p>
          <h1>{kind === 'sales' ? 'Ventas' : kind === 'terminals' ? 'Terminales' : 'Métodos de pago'}</h1>
          <p>Configuración y trazabilidad del punto de venta.</p>
        </div>
      </header>
      <section className="card overflow-hidden">
        {!rows.length ? (
          <div className="empty-state">
            <h2>No hay registros</h2>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código / número</th>
                  <th>Nombre / estado</th>
                  <th>Total</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {kind === 'sales' ? (
                        <a
                          className="font-semibold text-brand-700"
                          href={`${import.meta.env.BASE_URL}admin/sales/${x.id}`}
                        >
                          {x.saleNumber}
                        </a>
                      ) : (
                        x.code
                      )}
                    </td>
                    <td>{x.name ?? x.status}</td>
                    <td>{x.total ? `$${Number(x.total).toLocaleString('es-AR')}` : '—'}</td>
                    <td>{x.createdAt ? new Date(x.createdAt).toLocaleString('es-AR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
