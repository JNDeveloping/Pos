import { Activity, AlertTriangle, Banknote, Boxes, Clock3, LayoutDashboard, LogOut, MonitorUp, ReceiptText, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FullscreenButton } from '../components/FullscreenButton';
import { api, type Me } from '../lib/api';
import { clearTokens } from '../lib/auth-session';
import { appPath, navigate } from '../lib/navigation';

type LiveBranch = { id: string; name: string; code: string; salesToday: number; ticketsToday: number; openCash: number; lowStock: number; outOfStock: number; lastSale?: { completedAt: string; total: string; saleNumber: string } };
type Live = { generatedAt: string; branches: LiveBranch[] };
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function OwnerMonitor({ me }: { me: Me }) {
  const [live, setLive] = useState<Live>(), [error, setError] = useState(''), [clock, setClock] = useState(new Date());
  const load = useCallback(() => api<Live>('/dashboard/live').then((result) => { setLive(result); setError(''); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); const refresh = window.setInterval(() => void load(), 15000), timer = window.setInterval(() => setClock(new Date()), 1000); return () => { clearInterval(refresh); clearInterval(timer); }; }, [load]);
  const totals = useMemo(() => (live?.branches ?? []).reduce((result, branch) => ({ sales: result.sales + branch.salesToday, tickets: result.tickets + branch.ticketsToday, cash: result.cash + branch.openCash, alerts: result.alerts + branch.lowStock + branch.outOfStock }), { sales: 0, tickets: 0, cash: 0, alerts: 0 }), [live]);
  return <div className="owner-monitor">
    <header className="owner-monitor-header"><div className="owner-monitor-brand"><span><MonitorUp/></span><div><small>CENTRO EN VIVO</small><b>{me.company.name}</b></div></div><div className="owner-monitor-clock"><Activity/><span><b>Actualización automática</b><small>{clock.toLocaleTimeString('es-AR')}</small></span></div><a className="owner-admin-button" href={appPath('/admin')}><LayoutDashboard/>Panel de admin</a><FullscreenButton className="owner-icon-button"/><button className="owner-icon-button" title="Cerrar sesión" onClick={() => { clearTokens(); navigate('/login'); }}><LogOut/></button></header>
    <main><section className="owner-hero"><div><p className="eyebrow">TODAS LAS SUCURSALES</p><h1>Operación en tiempo real</h1><p>Ventas, cajas y alertas actualizadas cada 15 segundos.</p></div><span className={error ? 'offline' : 'online'}>{error ? error : '● En línea'}</span></section>
      <section className="owner-kpis"><article><span><Banknote/></span><div><small>Ventas de hoy</small><b>{money(totals.sales)}</b></div></article><article><span><ReceiptText/></span><div><small>Tickets</small><b>{totals.tickets}</b></div></article><article><span><Store/></span><div><small>Cajas abiertas</small><b>{totals.cash}</b></div></article><article><span><AlertTriangle/></span><div><small>Alertas de stock</small><b>{totals.alerts}</b></div></article></section>
      <section className="owner-branches"><header><div><h2>Sucursales</h2><p>Estado operativo y última actividad registrada.</p></div><button onClick={() => void load()}>Actualizar ahora</button></header><div className="owner-branch-grid">{live?.branches.map((branch) => <article key={branch.id}><div className="owner-branch-title"><span><Store/></span><div><h3>{branch.name}</h3><small>{branch.code}</small></div><i className={branch.openCash ? 'active' : ''}>{branch.openCash ? `${branch.openCash} caja${branch.openCash === 1 ? '' : 's'}` : 'Sin caja'}</i></div><dl><div><dt>Ventas hoy</dt><dd>{money(branch.salesToday)}</dd></div><div><dt>Tickets</dt><dd>{branch.ticketsToday}</dd></div><div><dt>Stock bajo</dt><dd>{branch.lowStock}</dd></div><div><dt>Sin stock</dt><dd>{branch.outOfStock}</dd></div></dl><footer>{branch.lastSale ? <><Clock3/><span>Última venta <b>{branch.lastSale.saleNumber}</b> · {new Date(branch.lastSale.completedAt).toLocaleTimeString('es-AR')} · {money(Number(branch.lastSale.total))}</span></> : <><Boxes/><span>Sin ventas registradas</span></>}</footer></article>)}</div></section>
    </main>
  </div>;
}
