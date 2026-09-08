import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Circle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { createPosLiveSocket } from '../lib/pos-live';

type EventRow = { id: string; branchId: string; terminalId: string; cashSessionId?: string; userId: string; type: string; payload: { total?: number; productName?: string; quantity?: number; saleNumber?: string; items?: { name: string; quantity: number; subtotal: number }[] }; createdAt: string };
type SessionRow = { id: string; branchId: string; terminalId: string; openedAt: string; openingAmount: string; terminal: { id: string; name: string; code: string }; cashier: { firstName: string; lastName: string } };
type State = { events: EventRow[]; sessions: SessionRow[]; branches: { id: string; name: string }[]; onlineTerminalIds: string[] };
const labels: Record<string, string> = { CONNECTED: 'Terminal conectada', DISCONNECTED: 'Terminal desconectada', SCANNED: 'Código escaneado', CART_UPDATED: 'Carrito actualizado', ITEM_REMOVED: 'Producto eliminado', DISCOUNT_APPLIED: 'Descuento aplicado', PAYMENT_STARTED: 'Cobro iniciado', PAYMENT_UPDATED: 'Pago actualizado', SALE_COMPLETED: 'Venta finalizada', SALE_CANCELLED: 'Venta anulada' };
const money = (value = 0) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export function CashLive() {
  const [state, setState] = useState<State>({ events: [], sessions: [], branches: [], onlineTerminalIds: [] });
  const [branchId, setBranchId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [error, setError] = useState('');
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams(); if (branchId) params.set('branchId', branchId); if (terminalId) params.set('terminalId', terminalId);
      setState(await api<State>(`/pos-live?${params}`)); setError('');
    } catch (reason) { setError((reason as Error).message); }
  }, [branchId, terminalId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const socket = createPosLiveSocket({ onConnected: () => { setSocketStatus('connected'); setError(''); }, onDisconnected: () => setSocketStatus('disconnected'), onError: (message) => { setSocketStatus('disconnected'); setError(`Tiempo real no disponible: ${message}. La actualización manual sigue disponible.`); } });
    socket.on('pos:event', (event: EventRow) => {
      setState((current) => ({ ...current, events: [event, ...current.events.filter((row) => row.id !== event.id)].slice(0, 250), onlineTerminalIds: event.type === 'CONNECTED' ? [...new Set([...current.onlineTerminalIds, event.terminalId])] : event.type === 'DISCONNECTED' ? current.onlineTerminalIds.filter((id) => id !== event.terminalId) : current.onlineTerminalIds }));
      if (event.type === 'CONNECTED' || event.type === 'SALE_COMPLETED') void load();
    });
    return () => { socket.disconnect(); };
  }, [load]);
  const visibleSessions = state.sessions.filter((session) => (!branchId || session.branchId === branchId) && (!terminalId || session.terminalId === terminalId));
  const visibleEvents = state.events.filter((event) => (!branchId || event.branchId === branchId) && (!terminalId || event.terminalId === terminalId));
  const carts = useMemo(() => new Map(visibleSessions.map((session) => [session.terminalId, visibleEvents.find((event) => event.terminalId === session.terminalId && event.type === 'CART_UPDATED')])), [visibleEvents, visibleSessions]);
  return <div className="space-y-5"><header className="page-heading"><div><p className="eyebrow">OPERACIÓN EN TIEMPO REAL</p><h1>Cajas en vivo</h1><p>Carritos y actividad operativa sin datos de pago sensibles.</p></div><button className="btn-secondary" onClick={() => void load()}><RefreshCw size={17}/>Actualizar</button></header><p className={socketStatus === 'connected' ? 'pos-feedback success' : 'pos-feedback warning'}>{socketStatus === 'connected' ? 'Monitor en vivo conectado.' : socketStatus === 'connecting' ? 'Conectando monitor en vivo…' : 'Monitor en vivo desconectado. Reintentando automáticamente…'}</p>{error && <p className="pos-feedback error">{error}</p>}<section className="card flex flex-wrap gap-3 p-4"><label>Sucursal<select value={branchId} onChange={(event) => { setBranchId(event.target.value); setTerminalId(''); }}><option value="">Todas</option>{state.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Terminal<select value={terminalId} onChange={(event) => setTerminalId(event.target.value)}><option value="">Todas</option>{state.sessions.filter((session) => !branchId || session.branchId === branchId).map((session) => <option key={session.terminalId} value={session.terminalId}>{session.terminal.name}</option>)}</select></label></section><div className="grid gap-5 xl:grid-cols-[1fr_420px]"><section className="grid gap-4 md:grid-cols-2">{visibleSessions.map((session) => { const cart = carts.get(session.terminalId); const online = state.onlineTerminalIds.includes(session.terminalId); return <article className="card p-5" key={session.id}><header className="flex items-center justify-between"><div><h2 className="text-xl font-bold">{session.terminal.name}</h2><small>{session.terminal.code} · {session.cashier.firstName} {session.cashier.lastName}</small></div><span className={online ? 'text-emerald-700' : 'text-red-700'}><Circle size={12} fill="currentColor"/> {online ? 'Conectada' : 'Desconectada'}</span></header><div className="mt-4 divide-y">{cart?.payload.items?.map((item, index) => <div className="flex justify-between py-2" key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><b>{money(item.subtotal)}</b></div>)}{!cart?.payload.items?.length && <p className="py-6 text-slate-500">Carrito vacío o sin actividad reciente.</p>}</div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><b>Total actual</b><strong>{money(cart?.payload.total)}</strong></div></article>; })}{!visibleSessions.length && <div className="card p-8 text-slate-500">No hay cajas abiertas para este filtro.</div>}</section><aside className="card max-h-[70vh] overflow-y-auto p-5"><h2 className="flex items-center gap-2 text-xl font-bold"><Activity/>Cronología</h2><div className="mt-4 divide-y">{visibleEvents.map((event) => <article className="py-3" key={event.id}><div className="flex justify-between gap-2"><b>{labels[event.type] ?? event.type}</b><time className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleTimeString('es-AR')}</time></div><small>{event.payload.productName ?? event.payload.saleNumber ?? ''}{event.payload.total !== undefined ? ` · ${money(event.payload.total)}` : ''}</small></article>)}</div></aside></div></div>;
}
