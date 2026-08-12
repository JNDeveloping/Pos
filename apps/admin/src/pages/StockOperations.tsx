import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, ClipboardCheck, History, PackageX } from 'lucide-react';
import { api } from '../lib/api';

const config = {
  movements: { title: 'Movimientos de stock', path: '/stock/movements', icon: History },
  inventory: { title: 'Inventarios', path: '/inventories', icon: ClipboardCheck },
  waste: { title: 'Mermas y roturas', path: '/waste', icon: PackageX },
  expirations: { title: 'Vencimientos y lotes', path: '/stock/expirations', icon: AlertTriangle },
  transfers: { title: 'Transferencias', path: '/transfers', icon: ArrowRightLeft },
} as const;
export function StockOperations({ kind }: { kind: keyof typeof config }) {
  const item = config[kind],
    Icon = item.icon,
    [data, setData] = useState<unknown[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api<unknown[]>(item.path)
      .then((value) => setData(Array.isArray(value) ? value : ((value as { data: unknown[] }).data ?? [])))
      .finally(() => setLoading(false));
  }, [item.path]);
  return (
    <div className="space-y-5">
      <header className="page-heading">
        <div>
          <p className="eyebrow">STOCK</p>
          <h1>{item.title}</h1>
          <p>Registro central, paginado y auditable por sucursal.</p>
        </div>
      </header>
      <section className="card">
        {loading ? (
          <div className="empty-state">Cargando…</div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <Icon size={44} />
            <h2>No hay registros todavía</h2>
            <p>
              {kind === 'transfers'
                ? 'Necesitás al menos dos sucursales activas para transferir mercadería.'
                : 'Los nuevos registros aparecerán aquí sin modificar stock silenciosamente.'}
            </p>
          </div>
        ) : (
          <pre className="max-h-[60vh] overflow-auto p-5 text-xs">{JSON.stringify(data, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
