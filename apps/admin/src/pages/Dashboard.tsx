import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  PackageX,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
type Summary = {
  todaySales: number;
  yesterdaySales: number;
  comparison: number | null;
  monthSales: number;
  ticketsToday: number;
  averageTicket: number;
  estimatedProfit: number;
  lowStock: number;
  outOfStock: number;
  expiring: number;
  lowMargin: number;
  daily: { date: string; total: number }[];
  topProducts: { productId: string; productNameSnapshot: string; _sum: { quantity: string; subtotal: string } }[];
  recentSales: {
    id: string;
    saleNumber: string;
    completedAt: string;
    total: string;
    user?: { firstName: string; lastName: string };
    payments: { paymentMethod: { name: string } }[];
  }[];
  paymentMethods: { name: string; total: number }[];
};
const money = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export function Dashboard() {
  const [s, setS] = useState<Summary>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const id = branchContext.get();
      setS(await api(`/dashboard/summary${id ? `?branchId=${id}` : ''}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const max = Math.max(1, ...(s?.daily.map((x) => x.total) ?? []));
  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div>
          <p className="eyebrow">OPERACIÓN DE HOY</p>
          <h1>Inicio</h1>
          <p>Ventas, rentabilidad y alertas que requieren una decisión.</p>
        </div>
        <button className="btn-secondary" onClick={() => void load()}>
          <RefreshCw className={busy ? 'animate-spin' : ''} size={17} />
          Actualizar
        </button>
      </header>
      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Ventas de hoy"
          value={money(s?.todaySales ?? 0)}
          icon={<TrendingUp />}
          hint={
            s?.comparison == null
              ? 'Sin base ayer'
              : `${s.comparison >= 0 ? '+' : ''}${s.comparison.toFixed(1)}% vs. ayer`
          }
          positive={(s?.comparison ?? 0) >= 0}
        />
        <Metric
          label="Ventas del mes"
          value={money(s?.monthSales ?? 0)}
          icon={<CalendarDays />}
          hint={`Ganancia estimada ${money(s?.estimatedProfit ?? 0)}`}
        />
        <Metric
          label="Tickets hoy"
          value={String(s?.ticketsToday ?? 0)}
          icon={<ReceiptText />}
          hint={`Promedio ${money(s?.averageTicket ?? 0)}`}
        />
        <Metric
          label="Alertas de stock"
          value={String((s?.lowStock ?? 0) + (s?.outOfStock ?? 0))}
          icon={<PackageX />}
          hint={`${s?.outOfStock ?? 0} sin stock`}
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <article className="card p-6">
          <h2 className="font-bold">Ventas últimos 7 días</h2>
          <div className="mt-6 flex h-52 items-end gap-3">
            {s?.daily.map((x) => (
              <div className="flex flex-1 flex-col items-center gap-2" key={x.date}>
                <b className="text-xs">{money(x.total)}</b>
                <div
                  className="w-full rounded-t-lg bg-brand-500"
                  style={{ height: `${Math.max(4, (x.total / max) * 150)}px` }}
                />
                <small>{new Date(x.date + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short' })}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card p-6">
          <h2 className="font-bold">Alertas importantes</h2>
          <div className="mt-4 space-y-3">
            <Alert label="Stock bajo" value={s?.lowStock} />
            <Alert label="Sin stock" value={s?.outOfStock} />
            <Alert label="Vencen en 30 días" value={s?.expiring} />
            <Alert label="Margen menor al 10%" value={s?.lowMargin} />
          </div>
        </article>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <article className="card overflow-hidden">
          <div className="border-b p-5">
            <h2 className="font-bold">Productos más vendidos del mes</h2>
          </div>
          {s?.topProducts?.length ? (
            s.topProducts.map((x, i) => (
              <div className="flex items-center gap-4 border-b px-5 py-3" key={x.productId}>
                <b className="text-brand-600">#{i + 1}</b>
                <span className="flex-1">{x.productNameSnapshot}</span>
                <strong>{Number(x._sum.quantity).toLocaleString('es-AR')} u.</strong>
              </div>
            ))
          ) : (
            <p className="empty-state">Todavía no hay ventas este mes.</p>
          )}
        </article>
        <article className="card overflow-hidden">
          <div className="border-b p-5">
            <h2 className="font-bold">Últimas ventas</h2>
          </div>
          {s?.recentSales?.length ? (
            s.recentSales.map((x) => (
              <a
                className="flex items-center gap-4 border-b px-5 py-3 hover:bg-slate-50"
                href={`/pos/admin/sales/${x.id}`}
                key={x.id}
              >
                <ShoppingBag size={18} />
                <span className="flex-1">
                  <b>{x.saleNumber}</b>
                  <small className="block text-slate-500">
                    {new Date(x.completedAt).toLocaleTimeString('es-AR')} · {x.user?.firstName ?? 'Cajero'}
                  </small>
                </span>
                <strong>{money(Number(x.total))}</strong>
              </a>
            ))
          ) : (
            <p className="empty-state">Sin ventas recientes.</p>
          )}
        </article>
      </section>
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
  hint,
  positive = true,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint: string;
  positive?: boolean;
}) {
  return (
    <article className="metric-card">
      <div className="flex justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <b className="mt-2 block text-3xl">{value}</b>
        </div>
        <span className="metric-icon bg-blue-50 text-brand-600">{icon}</span>
      </div>
      <p className={`mt-4 flex gap-1 text-xs ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {hint}
      </p>
    </article>
  );
}
function Alert({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle size={17} />
      <span className="flex-1">{label}</span>
      <b>{value ?? '—'}</b>
    </div>
  );
}
