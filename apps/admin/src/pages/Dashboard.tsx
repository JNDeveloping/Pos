import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, Building2, PackageX, ReceiptText, ShoppingBag, Store, Truck, Users, WalletCards } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { appPath } from '../lib/navigation';

type Summary = {
  todaySales: number; yesterdaySales: number; comparison: number | null; ticketsToday: number; averageTicket: number;
  lowStock: number; outOfStock: number; incompleteProducts: number; openCashCount: number; expectedCash: number;
  paymentMethods: { name: string; total: number }[];
  openCash: { id: string; branchId: string; terminal: string; cashier: string; expectedCash: number }[];
  branches: { id: string; name: string; code: string; salesToday: number; ticketsToday: number; openCash: number; alerts: number }[];
  recentSales: { id: string; saleNumber: string; completedAt: string; total: string; user?: { firstName: string; lastName: string }; payments: { paymentMethod: { name: string } }[] }[];
};
const money = (value = 0) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const quickLinks = [
  ['/', 'Abrir POS', Store], ['/products', 'Productos', Boxes], ['/products?tab=pricing', 'Cambiar precios', ReceiptText],
  ['/admin/stock', 'Stock', PackageX], ['/admin/purchases/new', 'Nueva compra', ShoppingBag], ['/admin/suppliers', 'Proveedores', Truck],
  ['/admin/cash-live', 'Cajas', WalletCards], ['/users', 'Usuarios', Users],
] as const;
export function Dashboard() {
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; const params = new URLSearchParams(); const branchId = branchContext.get(); if (branchId) params.set('branchId', branchId);
    setLoading(true); setError('');
    void api<Summary>(`/dashboard/summary?${params}`).then((data) => { if (active) setSummary(data); }).catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);
  return <div className="space-y-6">
    <header className="page-heading"><div><p className="eyebrow">RESUMEN OPERATIVO</p><h1 className="text-3xl font-bold">Inicio</h1><p>Lo necesario para controlar el negocio y actuar rápido.</p></div></header>
    {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error} <button className="ml-2 underline" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div>}
    {loading && <div className="card p-5 text-slate-500">Actualizando indicadores…</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Ventas de hoy" value={money(summary?.todaySales)} hint={summary?.comparison == null ? 'Sin ventas comparables ayer' : `${summary.comparison >= 0 ? '+' : ''}${summary.comparison.toFixed(1)}% contra ayer`} positive={(summary?.comparison ?? 0) >= 0}/>
      <Metric label="Ventas de ayer" value={money(summary?.yesterdaySales)} hint="Mismo cierre diario"/>
      <Metric label="Cantidad de ventas" value={String(summary?.ticketsToday ?? 0)} hint={`Ticket promedio ${money(summary?.averageTicket)}`}/>
      <Metric label="Efectivo estimado" value={money(summary?.expectedCash)} hint={`${summary?.openCashCount ?? 0} cajas abiertas`}/>
    </section>
    <section className="card p-5"><h2 className="font-bold">Accesos rápidos</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{quickLinks.map(([href,label,Icon]) => <a className="flex min-h-14 items-center gap-3 rounded-xl border px-4 font-semibold hover:border-brand-500 hover:bg-brand-50" href={appPath(href)} key={href}><Icon size={19}/>{label}</a>)}</div></section>
    <section className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
      <article className="card p-5"><h2 className="font-bold">Alertas importantes</h2><div className="mt-4 space-y-3"><Alert label="Productos sin stock" value={summary?.outOfStock} href="/admin/stock"/><Alert label="Productos con stock bajo" value={summary?.lowStock} href="/admin/stock"/><Alert label="Precio o costo incompleto" value={summary?.incompleteProducts} href="/products"/></div></article>
      <article className="card p-5"><h2 className="font-bold">Ventas de hoy por medio de pago</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{summary?.paymentMethods.length ? summary.paymentMethods.map((method) => <div className="rounded-xl bg-slate-50 p-4" key={method.name}><span className="text-sm text-slate-500">{method.name}</span><b className="mt-1 block text-xl">{money(method.total)}</b></div>) : <p className="empty-state">Todavía no hay cobros hoy.</p>}</div></article>
    </section>
    <section className="card overflow-hidden"><div className="border-b p-5"><h2 className="font-bold">Resumen por sucursal</h2></div><div className="table-wrap"><table><thead><tr><th>Sucursal</th><th>Ventas hoy</th><th>Tickets</th><th>Cajas abiertas</th><th>Alertas stock</th></tr></thead><tbody>{summary?.branches.map((branch) => <tr key={branch.id}><td><b>{branch.name}</b><small className="block text-slate-500">{branch.code}</small></td><td>{money(branch.salesToday)}</td><td>{branch.ticketsToday}</td><td>{branch.openCash}</td><td>{branch.alerts}</td></tr>)}</tbody></table></div></section>
    <section className="grid gap-5 xl:grid-cols-2"><article className="card overflow-hidden"><div className="border-b p-5"><h2 className="font-bold">Cajas abiertas</h2></div>{summary?.openCash.length ? summary.openCash.map((cash) => <div className="flex items-center gap-3 border-b px-5 py-3" key={cash.id}><Building2 size={18}/><span className="flex-1"><b>{cash.terminal}</b><small className="block text-slate-500">{cash.cashier}</small></span><strong>{money(cash.expectedCash)}</strong></div>) : <p className="empty-state">No hay cajas abiertas.</p>}</article><article className="card overflow-hidden"><div className="border-b p-5"><h2 className="font-bold">Últimas ventas</h2></div>{summary?.recentSales.length ? summary.recentSales.map((sale) => <a className="flex items-center gap-3 border-b px-5 py-3 hover:bg-brand-50" href={appPath(`/admin/sales/${sale.id}`)} key={sale.id}><ShoppingBag size={18}/><span className="flex-1"><b>{sale.saleNumber}</b><small className="block text-slate-500">{new Date(sale.completedAt).toLocaleString('es-AR')} · {sale.user?.firstName ?? 'Cajero'}</small></span><strong>{money(Number(sale.total))}</strong></a>) : <p className="empty-state">Sin ventas recientes.</p>}</article></section>
  </div>;
}
function Metric({ label, value, hint, positive = true }: { label: string; value: string; hint: string; positive?: boolean }) { return <article className="metric-card"><div><p className="text-sm text-slate-500">{label}</p><b className="mt-2 block text-2xl">{value}</b></div><p className={`mt-4 flex gap-1 text-xs ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{positive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {hint}</p></article>; }
function Alert({ label, value, href }: { label: string; value?: number; href: string }) { return <a href={appPath(href)} className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 hover:bg-amber-100"><AlertTriangle size={17}/><span className="flex-1">{label}</span><b>{value ?? '—'} ›</b></a>; }
