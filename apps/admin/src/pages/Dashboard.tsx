import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  PackageCheck,
  PackageX,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { appPath } from '../lib/navigation';

type Summary = {
  todaySales: number;
  yesterdaySales: number;
  comparison: number | null;
  monthSales: number;
  ticketsToday: number;
  averageTicket: number;
  estimatedProfit: number;
  grossMargin: number;
  productsToday: number;
  productsMonth: number;
  lowStock: number;
  outOfStock: number;
  expiring: number;
  lowMargin: number;
  periodDays: number;
  daily: { date: string; total: number }[];
  hourly: { hour: number; total: number; tickets: number }[];
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

const money = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function Dashboard() {
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState('');
  const [days, setDays] = useState<7 | 30>(7);
  const [chart, setChart] = useState<'bars' | 'line'>('bars');

  useEffect(() => {
    let active = true;
    const branchId = branchContext.get();
    const params = new URLSearchParams({ days: String(days) });
    if (branchId) params.set('branchId', branchId);
    setError('');
    void api<Summary>(`/dashboard/summary?${params}`)
      .then((data) => active && setSummary(data))
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [days]);

  const maxDaily = Math.max(1, ...(summary?.daily.map((item) => item.total) ?? []));
  const maxHourly = Math.max(1, ...(summary?.hourly.map((item) => item.total) ?? []));
  const paymentTotal = summary?.paymentMethods.reduce((total, method) => total + method.total, 0) ?? 0;
  const peak = useMemo(
    () => summary?.hourly.reduce((best, item) => (item.total > best.total ? item : best), summary.hourly[0]),
    [summary],
  );

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div>
          <p className="eyebrow">OPERACIÓN EN TIEMPO REAL</p>
          <h1>Inicio</h1>
          <p>Ventas, rentabilidad, demanda y alertas para tomar decisiones rápidas.</p>
        </div>
        <div className="dashboard-controls" aria-label="Opciones de visualización">
          <button className={days === 7 ? 'active' : ''} onClick={() => setDays(7)}>7 días</button>
          <button className={days === 30 ? 'active' : ''} onClick={() => setDays(30)}>30 días</button>
        </div>
      </header>

      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Ventas de hoy"
          value={money(summary?.todaySales ?? 0)}
          icon={<TrendingUp />}
          hint={summary?.comparison == null ? 'Sin base ayer' : `${summary.comparison >= 0 ? '+' : ''}${summary.comparison.toFixed(1)}% vs. ayer`}
          positive={(summary?.comparison ?? 0) >= 0}
        />
        <Metric label="Ventas del mes" value={money(summary?.monthSales ?? 0)} icon={<CalendarDays />} hint={`${summary?.productsMonth ?? 0} unidades vendidas`} />
        <Metric label="Tickets hoy" value={String(summary?.ticketsToday ?? 0)} icon={<ReceiptText />} hint={`Promedio ${money(summary?.averageTicket ?? 0)}`} />
        <Metric label="Ganancia estimada" value={money(summary?.estimatedProfit ?? 0)} icon={<WalletCards />} hint={`Margen bruto ${(summary?.grossMargin ?? 0).toFixed(1)}%`} />
        <Metric label="Productos vendidos hoy" value={Number(summary?.productsToday ?? 0).toLocaleString('es-AR')} icon={<PackageCheck />} hint="Cantidad total, incluidos pesables" />
        <Metric label="Sin stock" value={String(summary?.outOfStock ?? 0)} icon={<PackageX />} hint={`${summary?.lowStock ?? 0} productos con stock bajo`} positive={false} />
        <Metric label="Próximos vencimientos" value={String(summary?.expiring ?? 0)} icon={<AlertTriangle />} hint="Dentro de los próximos 30 días" positive={false} />
        <Metric label="Horario de mayor venta" value={peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—'} icon={<Clock3 />} hint={peak ? `${peak.tickets} tickets · ${money(peak.total)}` : 'Sin actividad en el período'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <article className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold">Evolución de ventas</h2><p className="text-sm text-slate-500">Últimos {days} días</p></div>
            <div className="dashboard-controls">
              <button className={chart === 'bars' ? 'active' : ''} onClick={() => setChart('bars')}>Barras</button>
              <button className={chart === 'line' ? 'active' : ''} onClick={() => setChart('line')}>Tendencia</button>
            </div>
          </div>
          <div className={`sales-chart ${chart === 'line' ? 'sales-chart-line' : ''}`}>
            {summary?.daily.map((item) => (
              <div className="sales-chart-column" key={item.date} title={`${item.date}: ${money(item.total)}`}>
                <b>{days === 7 ? money(item.total) : ''}</b>
                <div className="sales-chart-track"><span style={{ height: `${Math.max(3, (item.total / maxDaily) * 100)}%` }} /></div>
                <small>{new Date(`${item.date}T12:00`).toLocaleDateString('es-AR', { day: '2-digit', ...(days === 7 ? { weekday: 'short' } : {}) })}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-6">
          <h2 className="font-bold">Ventas por hora</h2>
          <p className="text-sm text-slate-500">Distribución del período seleccionado</p>
          <div className="hour-chart">
            {summary?.hourly.map((item) => <span key={item.hour} style={{ height: `${Math.max(2, (item.total / maxHourly) * 100)}%` }} title={`${item.hour}:00 · ${money(item.total)} · ${item.tickets} tickets`} />)}
          </div>
          <div className="flex justify-between text-xs text-slate-500"><span>00 h</span><span>06 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="card p-6">
          <h2 className="font-bold">Alertas accionables</h2>
          <div className="mt-4 space-y-3">
            <Alert label="Stock bajo" value={summary?.lowStock} href="/admin/stock" />
            <Alert label="Sin stock" value={summary?.outOfStock} href="/admin/stock" />
            <Alert label="Vencen en 30 días" value={summary?.expiring} href="/admin/expirations" />
            <Alert label="Margen menor al 10%" value={summary?.lowMargin} href="/products?tab=pricing" />
          </div>
        </article>
        <article className="card p-6 xl:col-span-2">
          <h2 className="font-bold">Participación por medio de pago</h2>
          <div className="mt-5 space-y-4">
            {summary?.paymentMethods.length ? summary.paymentMethods.map((method) => {
              const percentage = paymentTotal ? (method.total / paymentTotal) * 100 : 0;
              return <div key={method.name}><div className="flex justify-between text-sm"><b>{method.name}</b><span>{money(method.total)} · {percentage.toFixed(1)}%</span></div><div className="payment-bar"><span style={{ width: `${percentage}%` }} /></div></div>;
            }) : <p className="empty-state">Todavía no hay pagos este mes.</p>}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="card overflow-hidden">
          <div className="border-b p-5"><h2 className="font-bold">Productos más vendidos del mes</h2></div>
          {summary?.topProducts?.length ? summary.topProducts.map((item, index) => (
            <div className="flex items-center gap-4 border-b px-5 py-3" key={item.productId}>
              <b className="text-brand-600">#{index + 1}</b><span className="flex-1">{item.productNameSnapshot}</span><strong>{Number(item._sum.quantity).toLocaleString('es-AR')} u.</strong>
            </div>
          )) : <p className="empty-state">Todavía no hay ventas este mes.</p>}
        </article>
        <article className="card overflow-hidden">
          <div className="border-b p-5"><h2 className="font-bold">Últimas ventas</h2></div>
          {summary?.recentSales?.length ? summary.recentSales.map((sale) => (
            <a className="flex items-center gap-4 border-b px-5 py-3 hover:bg-brand-50" href={appPath(`/admin/sales/${sale.id}`)} key={sale.id}>
              <ShoppingBag size={18} /><span className="flex-1"><b>{sale.saleNumber}</b><small className="block text-slate-500">{new Date(sale.completedAt).toLocaleTimeString('es-AR')} · {sale.user?.firstName ?? 'Cajero'}</small></span><strong>{money(Number(sale.total))}</strong>
            </a>
          )) : <p className="empty-state">Sin ventas recientes.</p>}
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value, icon, hint, positive = true }: { label: string; value: string; icon: React.ReactNode; hint: string; positive?: boolean }) {
  return <article className="metric-card"><div className="flex justify-between gap-3"><div><p className="text-sm text-slate-500">{label}</p><b className="mt-2 block text-2xl">{value}</b></div><span className="metric-icon">{icon}</span></div><p className={`mt-4 flex gap-1 text-xs ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{hint}</p></article>;
}

function Alert({ label, value, href }: { label: string; value?: number; href: string }) {
  return <a href={appPath(href)} className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 transition hover:bg-amber-100"><AlertTriangle size={17} /><span className="flex-1">{label}</span><b>{value ?? '—'} ›</b></a>;
}
