import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Barcode,
  Calculator,
  ChevronRight,
  Expand,
  LayoutDashboard,
  Power,
  Minus,
  Pause,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { api, hasPermission, type Me } from '../lib/api';
import {
  addProductToCart,
  createQuickSaleLine,
  linePrice,
  lineSubtotal,
  POS_SHORTCUTS,
  paymentSummary,
  type CartLine,
  type PosProduct,
} from '../lib/pos-cart';
import type { Branch } from './Branches';
import { DEFAULT_POS_SETTINGS, type PosSettings } from '../lib/pos-settings';
import { appPath } from '../lib/navigation';
import { API } from '../lib/api';

type Method = { id: string; code: string; name: string; requiresReference: boolean; active?: boolean };
type Terminal = { id: string; name: string; code: string; branchId: string; active?: boolean; printerName?: string };
type QuickGroup = { id: string; name: string; icon?: string; buttonSize?: string; kind?: 'GROUP' | 'CATEGORY' };
type Cashier = { id: string; firstName: string; lastName: string; username: string };
type CashSession = { id: string; terminalId: string; cashierUserId: string; openingAmount: string; terminal: Terminal; cashier: Cashier };
type PosAppearance = { background?: string; backgroundOpacity?: number; backgroundOverlay?: string; backgroundBlur?: number; backgroundPosition?: string };
type Suspended = { id: string; at: string; cashier: string; branchId?: string; cart: CartLine[] };
type Modal = 'help' | 'search' | 'edit' | 'discount' | 'quickSale' | 'suspended' | 'utilities' | 'payment' | 'closeCash' | null;
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const isFractional = (line: Pick<CartLine, 'isWeighted' | 'unitType'>) => line.isWeighted || line.unitType !== 'UNIT';
const quantity = (line: CartLine) =>
  isFractional(line)
    ? `${line.quantity.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${line.unitType.toLocaleLowerCase('es-AR')}`
    : String(line.quantity);
const quickIcon = (name: string) => {
  const normalized = name.toLocaleLowerCase('es-AR');
  if (normalized.includes('pan')) return '🥖';
  if (normalized.includes('frut') || normalized.includes('verd')) return '🍎';
  if (normalized.includes('carb') || normalized.includes('leñ')) return '🔥';
  if (normalized.includes('fiambre')) return '🥩';
  if (normalized.includes('beb')) return '🥤';
  if (normalized.includes('láct') || normalized.includes('lact')) return '🥛';
  return '◉';
};

export function Pos({ me, branches, branchId, onBranchChange }: { me: Me; branches: Branch[]; branchId?: string; onBranchChange: (branchId: string) => void }) {
  const scanner = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosProduct[]>([]);
  const [favorites, setFavorites] = useState<PosProduct[]>([]);
  const [quickGroups, setQuickGroups] = useState<QuickGroup[]>([]);
  const [quickProducts, setQuickProducts] = useState<PosProduct[]>([]);
  const [activeQuickGroup, setActiveQuickGroup] = useState('favorites');
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('pos-cart') ?? '[]') as CartLine[];
    } catch {
      return [];
    }
  });
  const [selectedId, setSelectedId] = useState<string>();
  const [methods, setMethods] = useState<Method[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [cashSession, setCashSession] = useState<CashSession>();
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [cashierId, setCashierId] = useState(() => sessionStorage.getItem('pos-cashier-id') ?? me.user.id);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [newTerminalName, setNewTerminalName] = useState('Caja 1');
  const [closingAmount, setClosingAmount] = useState('0');
  const [closingNote, setClosingNote] = useState('');
  const [setupReady, setSetupReady] = useState(false);
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [appearance, setAppearance] = useState<PosAppearance>({});
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'info'; text: string }>();
  const [online, setOnline] = useState(navigator.onLine);
  const [clock, setClock] = useState(new Date());
  const [ticket, setTicket] = useState<any>();
  const [suspended, setSuspended] = useState<Suspended[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pos-suspended-sales') ?? '[]') as Suspended[];
    } catch {
      return [];
    }
  });
  const branch = branches.find((item) => item.id === branchId) ?? branches[0];
  const canOpenAdmin = hasPermission(me, 'panels.admin');
  const selected = cart.find((line) => line.id === selectedId);
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0), [cart]);
  const total = useMemo(() => cart.reduce((sum, line) => sum + lineSubtotal(line), 0), [cart]);
  const discount = subtotal - total;
  const focusScanner = useCallback(() => setTimeout(() => scanner.current?.focus(), 0), []);
  const searchRequest = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (!branch) return;
    setSetupReady(false);
    setCashSession(undefined);
    Promise.all([
      api<Method[]>('/payment-methods'),
      api<{ terminals: Terminal[]; cashiers: Cashier[] }>(`/cash-sessions/bootstrap?branchId=${branch.id}`),
      api<PosProduct[]>(`/pos/products/favorites?branchId=${branch.id}`),
      api<QuickGroup[]>(`/pos/products/quick-groups?branchId=${branch.id}`),
      api<{ appearance?: PosAppearance; pos?: PosSettings }>(`/pos/products/settings?branchId=${branch.id}`),
    ])
      .then(async ([paymentMethods, bootstrap, favoriteProducts, groups, serverSettings]) => {
        setMethods(paymentMethods.filter((item) => item.active !== false));
        const branchTerminals = bootstrap.terminals.filter((item) => item.active !== false);
        setTerminals(branchTerminals);
        setCashiers(bootstrap.cashiers);
        setCashierId((current) => bootstrap.cashiers.some((cashier) => cashier.id === current) ? current : (bootstrap.cashiers[0]?.id ?? me.user.id));
        const remembered = sessionStorage.getItem('pos-terminal-id');
        const nextTerminal = branchTerminals.find((item) => item.id === remembered)?.id ?? branchTerminals[0]?.id ?? '';
        setTerminalId(nextTerminal);
        if (nextTerminal) {
          const current = await api<CashSession | null>(`/cash-sessions/current?terminalId=${nextTerminal}`);
          if (current) { setCashSession(current); setCashierId(current.cashierUserId); }
        }
        setSettings({ ...DEFAULT_POS_SETTINGS, ...serverSettings.pos });
        setAppearance(serverSettings.appearance ?? {});
        setFavorites(favoriteProducts);
        setQuickProducts(favoriteProducts);
        setQuickGroups(groups);
        setActiveQuickGroup('favorites');
        setOnline(true);
        setSetupReady(true);
      })
      .catch((error: Error) => {
        setOnline(false);
        setMessage({ kind: 'error', text: error.message });
        setSetupReady(true);
      });
  }, [branch?.id]);
  useEffect(() => {
    sessionStorage.setItem('pos-cart', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem('pos-suspended-sales', JSON.stringify(suspended));
  }, [suspended]);
  useEffect(() => { if (ticket && settings.autoPrintTicket) window.setTimeout(() => window.print(), 150); }, [ticket, settings.autoPrintTicket]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    const connected = () => setOnline(true),
      disconnected = () => setOnline(false);
    addEventListener('online', connected);
    addEventListener('offline', disconnected);
    return () => {
      clearInterval(timer);
      removeEventListener('online', connected);
      removeEventListener('offline', disconnected);
    };
  }, []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (cart.length) event.preventDefault();
    };
    addEventListener('beforeunload', unload);
    return () => removeEventListener('beforeunload', unload);
  }, [cart.length]);

  const add = useCallback(
    (product: PosProduct, amount?: number) => {
      if (product.isWeighted && amount === undefined) {
        setSelectedId(product.id);
        setResults([product]);
        setModal('edit');
        return;
      }
      try {
        setCart((current) => {
          const next = addProductToCart(current, product, amount ?? 1);
          return next;
        });
        setSelectedId(product.id);
        setQuery('');
        setResults([]);
        setMessage({
          kind: 'ok',
          text: `${product.name} agregado`,
        });
      } catch (error) {
        setMessage({ kind: 'error', text: (error as Error).message });
      }
      focusScanner();
    },
    [focusScanner],
  );

  const lookup = useCallback(
    async (raw: string, addExact = true, signal?: AbortSignal) => {
      if (!branch || !raw.trim()) return;
      const term = raw.trim();
      setBusy(true);
      setMessage(undefined);
      try {
        if (/^\d{3,64}$/.test(term)) {
          let product: PosProduct;
          try {
            product = await api<PosProduct>(
              `/pos/products/by-barcode/${encodeURIComponent(term)}?branchId=${branch.id}`,
              { signal },
            );
          } catch (error) {
            if (signal?.aborted) return;
            const alternatives = await api<PosProduct[]>(
              `/pos/products/search?branchId=${branch.id}&q=${encodeURIComponent(term)}`,
              { signal },
            );
            if (alternatives.length !== 1) throw error;
            product = alternatives[0];
          }
          setOnline(true);
          if (addExact) add(product);
          else setResults([product]);
        } else {
          const found = await api<PosProduct[]>(
            `/pos/products/search?branchId=${branch.id}&q=${encodeURIComponent(term)}`,
            { signal },
          );
          setOnline(true);
          setResults(found);
          if (!found.length) setMessage({ kind: 'error', text: `No encontramos productos para “${term}”.` });
          else if (found.length === 1 && found[0].internalCode.toLowerCase() === term.toLowerCase() && addExact)
            add(found[0]);
          else setModal('search');
        }
      } catch (error) {
        if (signal?.aborted) return;
        const text = (error as Error).message;
        if (text.includes('Sin conexión')) setOnline(false);
        setMessage({ kind: 'error', text });
      } finally {
        setBusy(false);
      }
    },
    [add, branch],
  );

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || /^\d{3,64}$/.test(term) || modal) return;
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    const timer = setTimeout(() => void lookup(term, false, controller.signal), 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lookup, modal, query]);

  const openQuickGroup = async (groupId: string) => {
    if (!branch || busy) return;
    setActiveQuickGroup(groupId);
    if (groupId === 'favorites') {
      setQuickProducts(favorites);
      return;
    }
    setBusy(true);
    try {
      const group = quickGroups.find((item) => item.id === groupId);
      const path = group?.kind === 'GROUP' ? 'quick-group' : 'category';
      setQuickProducts(await api<PosProduct[]>(`/pos/products/${path}/${groupId}?branchId=${branch.id}`));
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openCash = async () => {
    if (!branch || !cashierId) return;
    setBusy(true); setMessage(undefined);
    try {
      const opened = await api<CashSession>('/cash-sessions/open', {
        method: 'POST',
        body: JSON.stringify({ branchId: branch.id, terminalId: terminalId || undefined, terminalName: 'Caja 1', cashierUserId: cashierId, openingAmount: Number(openingAmount || 0) }),
      });
      setCashSession(opened); setTerminalId(opened.terminalId); setTerminals((current) => current.some((item) => item.id === opened.terminal.id) ? current : [...current, opened.terminal]);
      sessionStorage.setItem('pos-terminal-id', opened.terminalId); sessionStorage.setItem('pos-cashier-id', opened.cashierUserId);
      setMessage({ kind: 'ok', text: `Caja abierta en ${opened.terminal.name}` }); focusScanner();
    } catch (error) { setMessage({ kind: 'error', text: (error as Error).message }); }
    finally { setBusy(false); }
  };
  const createTerminal = async () => {
    if (!branch || !newTerminalName.trim()) return;
    setBusy(true); setMessage(undefined);
    try {
      const created = await api<Terminal>('/terminals', { method: 'POST', body: JSON.stringify({ branchId: branch.id, name: newTerminalName.trim(), code: `CAJA-${terminals.length + 1}`, active: true }) });
      setTerminals((current) => [...current, created]); setTerminalId(created.id);
      setMessage({ kind: 'ok', text: `${created.name} creada. Ya podés abrir la caja.` });
    } catch (error) { setMessage({ kind: 'error', text: (error as Error).message }); }
    finally { setBusy(false); }
  };
  const closeCash = async () => {
    if (!cashSession || cart.length) return;
    setBusy(true); setMessage(undefined);
    try {
      await api('/cash-sessions/close', { method: 'POST', body: JSON.stringify({ cashSessionId: cashSession.id, closingAmount: Number(closingAmount || 0), closingNote: closingNote || undefined }) });
      setCashSession(undefined); setModal(null); setClosingAmount('0'); setClosingNote('');
      setMessage({ kind: 'ok', text: 'Caja cerrada correctamente. Podés abrir una nueva caja cuando la necesites.' });
    } catch (error) { setMessage({ kind: 'error', text: (error as Error).message }); }
    finally { setBusy(false); }
  };

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const line = cart.find((item) => item.id === selectedId);
    setCart(cart.filter((item) => item.id !== selectedId));
    setSelectedId(undefined);
    if (line) setMessage({ kind: 'info', text: `${line.name} eliminado de la venta` });
    focusScanner();
  }, [cart, selectedId, focusScanner]);
  const suspend = useCallback(() => {
    if (!cart.length) return;
    setSuspended((items) => [{ id: crypto.randomUUID(), at: new Date().toISOString(), cashier: `${me.user.firstName} ${me.user.lastName}`, branchId: branch?.id, cart }, ...items]);
    setCart([]);
    setSelectedId(undefined);
    setModal(null);
    setMessage({ kind: 'info', text: 'Venta suspendida' });
    focusScanner();
  }, [branch?.id, cart, focusScanner, me.user.firstName, me.user.lastName]);
  const openEdit = useCallback(
    (kind: Modal) => {
      if (!selected) return setMessage({ kind: 'info', text: 'Seleccioná un producto del carrito.' });
      if (kind === 'discount' && !hasPermission(me, 'sales.discountItem'))
        return setMessage({ kind: 'error', text: 'Tu usuario no tiene permiso para aplicar descuentos.' });
      setModal(kind);
    },
    [me, selected],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
      if (modal && event.key === 'Escape') {
        event.preventDefault();
        setModal(null);
        focusScanner();
        return;
      }
      if (modal) return;
      const action = POS_SHORTCUTS[event.key as keyof typeof POS_SHORTCUTS];
      if (action) {
        event.preventDefault();
        (
          ({
            HELP: () => setModal('help'),
            SEARCH: () => scanner.current?.focus(),
            QUANTITY: () => openEdit('edit'),
            PAY: () => cart.length && setModal('payment'),
            SUSPEND: suspend,
            RESUME: () => setModal('suspended'),
            DISCOUNT: () => openEdit('discount'),
            PRICE: () => openEdit('edit'),
            REMOVE: removeSelected,
            RECENT: () => setModal('utilities'),
            UTILITIES: () => setModal('utilities'),
          }) as Record<string, () => void>
        )[action]?.();
      } else if (!typing && selected && (event.key === '+' || event.key === '*')) {
        event.preventDefault();
        add(selected);
      } else if (!typing && selected && event.key === '-') {
        event.preventDefault();
        setCart((items) =>
          items.map((line) =>
            line.id === selected.id
              ? {
                  ...line,
                  quantity: Math.max(isFractional(line) ? 0.001 : 1, line.quantity - (isFractional(line) ? 0.05 : 1)),
                }
              : line,
          ),
        );
      }
    };
    addEventListener('keydown', handler);
    return () => removeEventListener('keydown', handler);
  }, [add, cart.length, focusScanner, modal, openEdit, removeSelected, selected, suspend]);

  const backgroundUrl = appearance.background
    ? appearance.background.startsWith('/api') ? `${API.replace(/\/api$/, '')}${appearance.background}` : appearance.background
    : undefined;
  if (ticket)
    return (
      <Ticket
        sale={ticket}
        branch={branch}
        cashier={cashSession ? `${cashSession.cashier.firstName} ${cashSession.cashier.lastName}` : `${me.user.firstName} ${me.user.lastName}`}
        next={() => {
          setTicket(undefined);
          setCart([]);
          focusScanner();
        }}
      />
    );
  return (
    <div
      className={`pos-shell pos-mode-${settings.mode} ${appearance.background ? 'pos-has-background' : ''}`}
      style={
        appearance.background
          ? ({
              '--pos-background': `url(${backgroundUrl})`,
              '--pos-overlay': String((appearance.backgroundOpacity ?? 20) / 100),
              '--pos-blur': `${appearance.backgroundBlur ?? 0}px`,
              '--pos-background-position': appearance.backgroundPosition ?? 'center',
            } as React.CSSProperties)
          : undefined
      }
    >
      <header className="pos-header">
        <div className="pos-brand-block">
          <span className="pos-brand-mark"><ShoppingCart /></span>
          <span><b>EL RINCÓN</b><small>CAJA RÁPIDA</small></span>
        </div>
        <div className="pos-session-chip">
          <span className={cashSession ? 'open' : ''} />
          <div><b>{cashSession ? 'Caja abierta' : 'Caja sin abrir'}</b><small>
            {branch?.name ?? 'Sin sucursal'} ·{' '}
            {terminals.find((item) => item.id === terminalId)?.name ?? 'Sin terminal'}
          </small></div>
        </div>
        <div className="pos-head-meta">
          <span>
            {me.user.firstName} {me.user.lastName}
          </span>
          <span>
            {settings.showClock ? clock.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
          <span className={online ? 'pos-online' : 'pos-offline'}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />} {online ? 'Conectado' : 'Sin conexión'}
          </span>
          <button title="Pantalla completa" onClick={() => void document.documentElement.requestFullscreen()}>
            <Expand size={18} />
          </button>
          {cashSession && hasPermission(me, 'cashSessions.close') && <button className="pos-close-cash" title="Cerrar caja" onClick={() => { if (cart.length) setMessage({ kind: 'error', text: 'Terminá o cancelá la venta antes de cerrar la caja.' }); else setModal('closeCash'); }}><Power size={18}/><span>CERRAR CAJA</span></button>}
          {canOpenAdmin && (
            <a className="pos-admin-link" href={appPath('/admin')} title="Abrir centro de administración">
              <LayoutDashboard size={18} /> <span>ADMIN</span>
            </a>
          )}
          <a className="pos-admin-link" href={appPath('/cashier')} title="Abrir herramientas autorizadas de caja">
            <LayoutDashboard size={18} /> <span>HERRAMIENTAS</span>
          </a>
        </div>
      </header>
      {setupReady && !cashSession && (
        <div className="pos-opening-backdrop">
          <section className="pos-opening-card">
            <div><p className="eyebrow">INICIO RÁPIDO</p><h1>Abrir caja</h1><p>Elegí dónde y con quién vas a operar. Se recordará durante esta sesión.</p></div>
            <label>Sucursal habilitada<select value={branch?.id ?? ''} onChange={(event) => onBranchChange(event.target.value)}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Sólo se muestran las sucursales habilitadas para tu usuario.</small></label>
            <label>Cajero<select value={cashierId} onChange={(event) => setCashierId(event.target.value)}>{cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.firstName} {cashier.lastName} · {cashier.username}</option>)}</select></label>
            <label>Terminal<select value={terminalId} onChange={(event) => setTerminalId(event.target.value)}><option value="">Seleccionar terminal</option>{terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name} · {terminal.code}</option>)}</select></label>
            {!terminals.length && hasPermission(me, 'terminals.manage') && <div className="pos-quick-terminal"><label>Nombre de la nueva terminal<input value={newTerminalName} onChange={(event) => setNewTerminalName(event.target.value)}/></label><button type="button" disabled={busy || !newTerminalName.trim()} onClick={() => void createTerminal()}>CREAR TERMINAL</button></div>}
            {!terminals.length && !hasPermission(me, 'terminals.manage') && <p className="pos-feedback error">No hay terminales configuradas. Un administrador debe crear la primera terminal.</p>}
            <label>Fondo inicial<input inputMode="decimal" type="number" min="0" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} /></label>
            {message?.kind === 'error' && <p className="pos-feedback error">{message.text}</p>}
            {hasPermission(me, 'cashSessions.open') ? <button className="pos-open-button" disabled={busy || !branch || !cashierId || !terminalId} onClick={() => void openCash()}>{busy ? 'Abriendo…' : 'ABRIR CAJA'}</button> : <p className="pos-feedback error">Tu rol no tiene permiso para abrir una caja.</p>}
          </section>
        </div>
      )}
      <main className="pos-grid">
        <section className="pos-cart">
          <div className="pos-search">
            <Barcode />
            <input
              ref={scanner}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const scanned = query;
                setQuery('');
                void lookup(scanned);
              }}
              placeholder="Escanear o buscar nombre, código interno, SKU o código alternativo (F2)"
            />
            <button disabled={busy} onClick={() => void lookup(query)}>
              <Search />
            </button>
            {hasPermission(me, 'sales.manualPrice') && (
              <button className="pos-quick-sale-button" type="button" title="Venta rápida sin producto registrado" onClick={() => setModal('quickSale')}>
                <Plus /> Venta rápida
              </button>
            )}
          </div>
          {message && <div className={`pos-feedback ${message.kind}`}>{message.text}</div>}
          {(quickGroups.length > 0 || favorites.length > 0) && (
            <section className="pos-quick-access" aria-label="Accesos rápidos por categoría">
              <div className="pos-quick-groups">
                <button className={activeQuickGroup === 'favorites' ? 'active' : ''} onClick={() => void openQuickGroup('favorites')}>
                  <span>★</span><b>Favoritos</b>
                </button>
                {quickGroups.map((group) => (
                  <button className={activeQuickGroup === group.id ? 'active' : ''} key={group.id} onClick={() => void openQuickGroup(group.id)}>
                    <span>{group.icon || quickIcon(group.name)}</span><b>{group.name}</b><ChevronRight size={14} />
                  </button>
                ))}
              </div>
              {!!quickProducts.length && (
                <div className={`pos-quick-products size-${quickGroups.find((group) => group.id === activeQuickGroup)?.buttonSize?.toLowerCase() ?? 'medium'}`} style={{ gridTemplateColumns: `repeat(${settings.favoriteColumns}, minmax(130px, 1fr))` }}>
                  {quickProducts.map((product) => (
                    <button key={product.id} onClick={() => add(product)}>
                      <small>{product.category ?? 'Rápido'}</small>
                      <span>{product.shortName || product.name}</span>
                      <b>{money(Number(product.price))}</b>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <div className="pos-table-head">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Precio</span>
            <span>Dto.</span>
            <span>Subtotal</span>
          </div>
          <div className="pos-lines">
            {!cart.length ? (
              <div className="pos-empty">
                <ShoppingCart size={52} />
                <h2>Venta nueva</h2>
                <p>Escaneá o buscá el primer producto.</p>
              </div>
            ) : (
              cart.map((line) => (
                <article
                  key={line.id}
                  className={selectedId === line.id ? 'selected' : ''}
                  onClick={() => setSelectedId(line.id)}
                  onDoubleClick={() => {
                    setSelectedId(line.id);
                    setModal('edit');
                  }}
                >
                  <div>
                    <b>
                      {line.name} {line.isWeighted && <em>KG</em>}
                    </b>
                    <small>
                      {line.internalCode}
                      {settings.showBarcode && line.barcode ? ` · ${line.barcode}` : ''}
                      {line.note ? ` · ${line.note}` : ''}
                    </small>
                  </div>
                  <div className="pos-quantity">
                    <button
                      onClick={() =>
                        setCart(
                          cart.map((x) =>
                            x.id === line.id
                              ? {
                                  ...x,
                                  quantity: Math.max(
                                    isFractional(line) ? 0.001 : 1,
                                    x.quantity - (isFractional(line) ? 0.05 : 1),
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      <Minus />
                    </button>
                    <strong>{quantity(line)}</strong>
                    <button onClick={() => add(line)}>
                      <Plus />
                    </button>
                  </div>
                  <span>{money(linePrice(line))}</span>
                  <span>
                    {line.discountPercent
                      ? `${line.discountPercent}%`
                      : line.discountAmount
                        ? money(line.discountAmount)
                        : '—'}
                  </span>
                  <strong>{money(lineSubtotal(line))}</strong>
                  <button
                    className="pos-delete"
                    aria-label={`Eliminar ${line.name}`}
                    onClick={() => {
                      setSelectedId(line.id);
                      setCart(cart.filter((x) => x.id !== line.id));
                      focusScanner();
                    }}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))
            )}
          </div>
          <div className="pos-shortcut-bar">
            {[
              ['F1', 'Ayuda'],
              ['F2', 'Buscar'],
              ['F3', 'Cantidad'],
              ['F4', 'Cobrar'],
              ['F5', 'Suspender'],
              ['F6', 'Recuperar'],
              ['F7', 'Descuento'],
              ['F12', 'Utilidades'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => dispatchEvent(new KeyboardEvent('keydown', { key }))}>
                <kbd>{key}</kbd>
                {label}
              </button>
            ))}
          </div>
        </section>
        <aside className="pos-summary">
          <p>RESUMEN DE VENTA</p>
          <dl>
            <div>
              <dt>Renglones</dt>
              <dd>{cart.length}</dd>
            </div>
            <div>
              <dt>Unidades</dt>
              <dd>{cart.reduce((n, x) => n + x.quantity, 0).toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <div className="discount">
              <dt>Descuentos</dt>
              <dd>- {money(discount)}</dd>
            </div>
          </dl>
          <div className="pos-total">
            <span>TOTAL</span>
            <b>{money(total)}</b>
          </div>
          <button
            className="pos-pay"
            disabled={!cart.length || !terminalId || !cashSession || !online}
            onClick={() => setModal('payment')}
          >
            <Banknote /> COBRAR <kbd>F4</kbd>
          </button>
          <div className="pos-actions">
            <button disabled={!selected} onClick={() => openEdit('edit')}>
              Editar ítem
            </button>
            <button disabled={!cart.length} onClick={suspend}>
              <Pause /> Suspender
            </button>
            <button
              disabled={!cart.length}
              onClick={() => {
                if (confirm('¿Cancelar la venta actual?')) {
                  setCart([]);
                  setSelectedId(undefined);
                  focusScanner();
                }
              }}
            >
              <X /> Cancelar
            </button>
          </div>
          {!cashSession && <p className="pos-warning">Abra una caja para comenzar a vender.</p>}
        </aside>
      </main>
      {modal === 'search' && (
        <SearchModal
          results={results}
          close={() => {
            setModal(null);
            focusScanner();
          }}
          select={(p) => {
            setModal(null);
            add(p);
          }}
        />
      )}
      {modal === 'help' && (
        <HelpModal
          close={() => {
            setModal(null);
            focusScanner();
          }}
        />
      )}
      {modal === 'edit' && (
        <EditModal
          line={selected ?? results[0]}
          canPrice={hasPermission(me, 'sales.manualPrice')}
          close={() => {
            setModal(null);
            focusScanner();
          }}
          save={(values) => {
            const base = selected ?? results[0];
            if (!base) return;
            if (selected) setCart(cart.map((line) => (line.id === base.id ? { ...line, ...values } : line)));
            else add(base, values.quantity);
            setModal(null);
            focusScanner();
          }}
        />
      )}
      {modal === 'discount' && selected && (
        <DiscountModal
          line={selected}
          close={() => {
            setModal(null);
            focusScanner();
          }}
          save={(values) => {
            setCart(cart.map((line) => (line.id === selected.id ? { ...line, ...values } : line)));
            setModal(null);
            focusScanner();
          }}
        />
      )}
      {modal === 'quickSale' && (
        <QuickSaleModal
          close={() => { setModal(null); focusScanner(); }}
          save={(name, price, amount) => {
            try {
              const line = createQuickSaleLine(name, price, amount);
              setCart((current) => [...current, line]);
              setSelectedId(line.id);
              setModal(null);
              setMessage({ kind: 'ok', text: `${line.name} agregado como venta rápida` });
              focusScanner();
            } catch (error) {
              setMessage({ kind: 'error', text: (error as Error).message });
            }
          }}
        />
      )}
      {modal === 'suspended' && (
        <SuspendedModal
          sales={suspended.filter((sale) => !sale.branchId || sale.branchId === branch?.id)}
          close={() => {
            setModal(null);
            focusScanner();
          }}
          resume={(sale) => {
            setCart(sale.cart);
            setSuspended(suspended.filter((x) => x.id !== sale.id));
            setModal(null);
            setMessage({ kind: 'info', text: 'Venta recuperada' });
            focusScanner();
          }}
        />
      )}
      {modal === 'utilities' && (
        <UtilitiesModal
          branchId={branch?.id}
          recent={() => api<any[]>(`/sales?q=`)}
          close={() => {
            setModal(null);
            focusScanner();
          }}
        />
      )}
      {modal === 'payment' && (
        <PaymentModal
          total={total}
          methods={methods}
          busy={busy}
          close={() => {
            setModal(null);
            focusScanner();
          }}
          confirm={async (payments) => {
            if (!branch) return;
            setBusy(true);
            try {
              const sale = await api('/sales', {
                method: 'POST',
                body: JSON.stringify({
                  operationId: crypto.randomUUID(),
                  branchId: branch.id,
                  terminalId,
                  cashSessionId: cashSession?.id,
                  items: cart.map((line) => ({
                    productId: line.quickSale ? undefined : line.id,
                    description: line.quickSale ? line.name : undefined,
                    quantity: line.quantity,
                    expectedUnitPrice: line.originalPrice,
                    manualPrice: line.manualPrice,
                    discountPercent: line.discountPercent,
                    discountAmount: line.discountAmount,
                    note: line.note,
                  })),
                  payments,
                }),
              });
              setModal(null);
              setTicket(sale);
            } catch (error) {
              setMessage({ kind: 'error', text: (error as Error).message });
              setModal(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {modal === 'closeCash' && cashSession && <ModalFrame title="Dar de baja y cerrar caja" close={() => setModal(null)}><div className="pos-form"><div className="cash-close-summary"><span>Terminal<b>{cashSession.terminal.name}</b></span><span>Fondo inicial<b>{money(Number(cashSession.openingAmount))}</b></span></div><label>Efectivo contado al cierre<input autoFocus inputMode="decimal" type="number" min="0" step="0.01" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)}/></label><label>Observación opcional<textarea value={closingNote} onChange={(event) => setClosingNote(event.target.value)} placeholder="Diferencias, retiro, observaciones…"/></label><p className="pos-feedback info">Esta acción deja la caja cerrada y registra el responsable en Auditoría.</p><button className="pos-close-confirm" disabled={busy || cart.length > 0 || Number(closingAmount) < 0} onClick={() => void closeCash()}>{busy ? 'Cerrando…' : 'Confirmar cierre de caja'}</button></div></ModalFrame>}
    </div>
  );
}

function ModalFrame({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return (
    <div className="pos-modal" role="dialog" aria-modal="true">
      <div className="pos-dialog">
        <header>
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function SearchModal({
  results,
  close,
  select,
}: {
  results: PosProduct[];
  close: () => void;
  select: (p: PosProduct) => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(results.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter' && results[index]) {
        e.preventDefault();
        select(results[index]);
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [index, results, select]);
  return (
    <ModalFrame title="Resultados de búsqueda" close={close}>
      <div className="pos-results">
        {results.map((p, i) => (
          <button className={i === index ? 'selected' : ''} key={p.id} onClick={() => select(p)}>
            <span>
              <b>{p.name}</b>
              <small>
                {p.brand ?? 'Sin marca'} · {p.presentation ?? p.unitType} · {p.barcode ?? p.internalCode}
              </small>
            </span>
            <span>Stock {p.available}</span>
            <strong>{money(Number(p.price))}</strong>
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}
function HelpModal({ close }: { close: () => void }) {
  return (
    <ModalFrame title="Atajos del POS" close={close}>
      <div className="shortcut-help">
        {Object.entries(POS_SHORTCUTS).map(([key, action]) => (
          <div key={key}>
            <kbd>{key}</kbd>
            <span>
              {
                (
                  {
                    HELP: 'Ayuda',
                    SEARCH: 'Buscar / scanner',
                    QUANTITY: 'Editar cantidad',
                    PAY: 'Cobrar',
                    SUSPEND: 'Suspender',
                    RESUME: 'Recuperar',
                    DISCOUNT: 'Descuento',
                    PRICE: 'Precio manual',
                    REMOVE: 'Eliminar ítem',
                    RECENT: 'Ventas recientes',
                    UTILITIES: 'Utilidades',
                  } as Record<string, string>
                )[action]
              }
            </span>
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}
function EditModal({
  line,
  canPrice,
  close,
  save,
}: {
  line?: CartLine | PosProduct;
  canPrice: boolean;
  close: () => void;
  save: (v: { quantity: number; manualPrice?: number; note?: string }) => void;
}) {
  const [qty, setQty] = useState(String(line && 'quantity' in line ? line.quantity : line && isFractional(line) ? '' : 1)),
    [price, setPrice] = useState(line ? linePrice(line as CartLine) : 0),
    [note, setNote] = useState(line && 'note' in line ? line.note ?? '' : '');
  if (!line) return null;
  return (
    <ModalFrame title={line.isWeighted ? 'Ingresar peso' : isFractional(line) ? 'Ingresar cantidad fraccionada' : 'Editar producto'} close={close}>
      <form
        className="pos-form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ quantity: Number(qty), manualPrice: price !== Number(line.price) ? price : undefined, note: note.trim() || undefined });
        }}
      >
        <h3>{line.name}</h3>
        <label>
          {line.isWeighted ? 'Peso (kg)' : 'Cantidad'}
          <input
            autoFocus
            type="number"
            min={isFractional(line) ? '.001' : '1'}
            step={isFractional(line) ? '.001' : '1'}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <div className="pos-number-pad" aria-label="Teclado numérico">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', isFractional(line) ? '.' : '00', '0', '⌫'].map((key) => (
            <button type="button" key={key} onClick={() => setQty((current) => key === '⌫' ? current.slice(0, -1) : key === '.' && current.includes('.') ? current : `${current}${key}`)}>{key}</button>
          ))}
        </div>
        <label>
          Precio unitario
          <input
            type="number"
            disabled={!canPrice || !line.allowManualPrice}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        <p>
          Subtotal estimado <b>{money(Number(qty) * price)}</b>
        </p>
        <label>Nota opcional<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ej. separar en dos bolsas"/></label>
        <button className="pos-pay" disabled={Number(qty) <= 0}>
          CONFIRMAR
        </button>
      </form>
    </ModalFrame>
  );
}
function DiscountModal({
  line,
  close,
  save,
}: {
  line: CartLine;
  close: () => void;
  save: (v: { discountPercent: number; discountAmount: number }) => void;
}) {
  const [percent, setPercent] = useState(line.discountPercent),
    [amount, setAmount] = useState(line.discountAmount);
  return (
    <ModalFrame title={`Descuento · ${line.name}`} close={close}>
      <div className="discount-presets">
        {[0, 5, 10].map((v) => (
          <button
            key={v}
            onClick={() => {
              setPercent(v);
              setAmount(0);
            }}
          >
            {v ? v + '%' : 'Sin descuento'}
          </button>
        ))}
      </div>
      <div className="pos-form">
        <label>
          Porcentaje
          <input
            autoFocus
            type="number"
            min="0"
            max="100"
            value={percent}
            onChange={(e) => {
              setPercent(Number(e.target.value));
              setAmount(0);
            }}
          />
        </label>
        <label>
          Monto fijo
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => {
              setAmount(Number(e.target.value));
              setPercent(0);
            }}
          />
        </label>
        <button className="pos-pay" onClick={() => save({ discountPercent: percent, discountAmount: amount })}>
          APLICAR
        </button>
      </div>
    </ModalFrame>
  );
}

function QuickSaleModal({ close, save }: { close: () => void; save: (name: string, price: number, quantity: number) => void }) {
  const [name, setName] = useState('Venta rápida');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  return (
    <ModalFrame title="Venta rápida sin producto registrado" close={close}>
      <form className="pos-form" onSubmit={(event) => { event.preventDefault(); save(name, Number(price), Number(quantity)); }}>
        <p className="pos-feedback info">No modifica stock. Requiere permiso de precio manual y queda identificada en venta y auditoría.</p>
        <label>Descripción<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label>
        <label>Precio<input autoFocus inputMode="decimal" type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        <label>Cantidad<input inputMode="decimal" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <button className="pos-pay" disabled={!name.trim() || Number(price) <= 0 || Number(quantity) <= 0}>AGREGAR</button>
      </form>
    </ModalFrame>
  );
}
function SuspendedModal({
  sales,
  close,
  resume,
}: {
  sales: Suspended[];
  close: () => void;
  resume: (s: Suspended) => void;
}) {
  return (
    <ModalFrame title="Ventas suspendidas" close={close}>
      <div className="pos-results">
        {!sales.length ? (
          <p className="pos-empty">No hay ventas suspendidas.</p>
        ) : (
          sales.map((s) => (
            <button key={s.id} onClick={() => resume(s)}>
              <span>
                <b>{new Date(s.at).toLocaleTimeString('es-AR')}</b>
                <small>{s.cart.reduce((sum, line) => sum + line.quantity, 0).toLocaleString('es-AR')} productos · {s.cashier || 'Cajero actual'}</small>
              </span>
              <strong>{money(s.cart.reduce((n, x) => n + lineSubtotal(x), 0))}</strong>
            </button>
          ))
        )}
      </div>
    </ModalFrame>
  );
}
function UtilitiesModal({ branchId, close }: { branchId?: string; recent: () => Promise<any[]>; close: () => void }) {
  const [calc, setCalc] = useState(''),
    [lookup, setLookup] = useState(''),
    [product, setProduct] = useState<PosProduct>();
  const calculate = () => {
    if (!/^[0-9+\-*/(). ]+$/.test(calc)) return;
    try {
      setCalc(String(Function(`"use strict";return (${calc})`)()));
    } catch {
      setCalc('Error');
    }
  };
  return (
    <ModalFrame title="Utilidades" close={close}>
      <div className="utilities-grid">
        <section>
          <Calculator />
          <h3>Calculadora</h3>
          <input
            value={calc}
            onChange={(e) => setCalc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && calculate()}
          />
          <button onClick={calculate}>= Calcular</button>
        </section>
        <section>
          <Search />
          <h3>Consultar precio y stock</h3>
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && branchId) {
                try {
                  setProduct(await api(`/pos/products/by-barcode/${encodeURIComponent(lookup)}?branchId=${branchId}`));
                } catch {
                  const rows = await api<PosProduct[]>(
                    `/pos/products/search?branchId=${branchId}&q=${encodeURIComponent(lookup)}`,
                  );
                  setProduct(rows[0]);
                }
              }
            }}
          />
          <p>
            {product ? (
              <>
                <b>{product.name}</b>
                <br />
                {money(Number(product.price))} · Stock {product.available}
                <br />
                {product.location ?? 'Sin ubicación'}
              </>
            ) : (
              'Escaneá sin agregar al carrito.'
            )}
          </p>
        </section>
      </div>
    </ModalFrame>
  );
}
function PaymentModal({
  total,
  methods,
  busy,
  close,
  confirm,
}: {
  total: number;
  methods: Method[];
  busy: boolean;
  close: () => void;
  confirm: (rows: any[]) => Promise<void>;
}) {
  const [rows, setRows] = useState([
    { paymentMethodId: methods[0]?.id ?? '', amount: total, receivedAmount: total, reference: '' },
  ]);
  const { remaining, change } = paymentSummary(total, rows.map((row) => ({ amount: Number(row.amount), receivedAmount: Number(row.receivedAmount), isCash: methods.find((item) => item.id === row.paymentMethodId)?.code === 'CASH' })));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const code: { [k: string]: string } = { e: 'CASH', d: 'DEBIT', c: 'CREDIT', m: 'MERCADO_PAGO', t: 'TRANSFER' };
      const method = methods.find((x) => x.code === code[e.key.toLowerCase()]);
      if (method && !['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setRows([{ paymentMethodId: method.id, amount: total, receivedAmount: total, reference: '' }]);
      }
      if (e.key === 'Enter' && remaining === 0 && !busy && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        void confirm(rows);
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [busy, confirm, methods, remaining, rows, total]);
  return (
    <ModalFrame title="Cobrar venta" close={close}>
      <div className="payment-total">
        TOTAL <b>{money(total)}</b>
      </div>
      <div className="payment-method-buttons">
        {!methods.length && <p className="pos-feedback error">No hay medios de pago configurados. Recargá el POS o pedí a un administrador que revise la configuración.</p>}
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setRows([{ paymentMethodId: m.id, amount: total, receivedAmount: total, reference: '' }])}
          >
            {m.name}
            <kbd>
              {m.code === 'CASH'
                ? 'E'
                : m.code === 'DEBIT'
                  ? 'D'
                  : m.code === 'CREDIT'
                    ? 'C'
                    : m.code === 'MERCADO_PAGO'
                      ? 'M'
                      : m.code === 'TRANSFER'
                        ? 'T'
                        : ''}
            </kbd>
          </button>
        ))}
      </div>
      {rows.map((row, index) => {
        const method = methods.find((item) => item.id === row.paymentMethodId);
        return <div className="payment-row" key={index}>
          <select
            value={row.paymentMethodId}
            onChange={(e) => setRows(rows.map((x, i) => (i === index ? { ...x, paymentMethodId: e.target.value } : x)))}
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={row.amount}
            onChange={(e) => setRows(rows.map((x, i) => (i === index ? { ...x, amount: Number(e.target.value) } : x)))}
          />
          {method?.code === 'CASH' ? <input type="number" min={row.amount} step="0.01" value={row.receivedAmount} onChange={(e) => setRows(rows.map((x, i) => (i === index ? { ...x, receivedAmount: Number(e.target.value) } : x)))} placeholder="Efectivo recibido"/> : <input value={row.reference} required={method?.requiresReference} onChange={(e) => setRows(rows.map((x, i) => (i === index ? { ...x, reference: e.target.value } : x)))} placeholder={method?.requiresReference ? 'Referencia / comprobante' : 'Referencia opcional'}/>}
          {rows.length > 1 && <button type="button" aria-label="Quitar medio" onClick={() => setRows(rows.filter((_, i) => i !== index))}><X/></button>}
        </div>;
      })}
      <button
        className="pos-add-payment"
        onClick={() =>
          setRows([
            ...rows,
            {
              paymentMethodId: methods[0]?.id ?? '',
              amount: Math.max(0, remaining),
              receivedAmount: Math.max(0, remaining),
              reference: '',
            },
          ])
        }
      >
        + Agregar otro medio
      </button>
      <div className="payment-remaining">
        <span>Pendiente</span>
        <b>{money(remaining)}</b>
      </div>
      {change > 0 && <div className="payment-change"><span>VUELTO</span><b>{money(change)}</b></div>}
      <button className="pos-pay" disabled={busy || remaining !== 0 || !methods.length || rows.some((row) => { const method = methods.find((item) => item.id === row.paymentMethodId); return !row.paymentMethodId || (method?.requiresReference && !row.reference.trim()); })} onClick={() => void confirm(rows)}>
        {busy ? 'PROCESANDO…' : 'CONFIRMAR · ENTER'}
      </button>
    </ModalFrame>
  );
}
function Ticket({ sale, branch, cashier, next }: { sale: any; branch?: Branch; cashier: string; next: () => void }) {
  const change = (sale.payments ?? []).reduce((n: number, p: any) => n + Number(p.changeAmount ?? 0), 0);
  return (
    <div className="ticket-screen">
      <div className="sale-success">
        <strong>✓ VENTA REALIZADA</strong>
        <span>{sale.saleNumber}</span>
        <b>{money(Number(sale.total))}</b>
        {change > 0 && <span>Vuelto: {money(change)}</span>}
      </div>
      <div className="ticket-actions">
        <button className="btn-secondary" onClick={next}>
          No imprimir · nueva venta
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          Imprimir / reimprimir ticket
        </button>
      </div>
      <article className="ticket">
        <h2>El Rincón de los Nietos</h2>
        <p>{branch?.name}</p>
        <hr />
        <p>
          Venta {sale.saleNumber}
          <br />
          {new Date(sale.completedAt).toLocaleString('es-AR')}
          <br />
          Cajero: {cashier}
        </p>
        <hr />
        {sale.items.map((x: any) => (
          <div key={x.id}>
            <span>
              {x.productNameSnapshot} · {x.quantity} × {money(Number(x.unitPrice))}
            </span>
            <b>{money(Number(x.subtotal))}</b>
          </div>
        ))}
        <hr />
        <div className="ticket-grand">
          <span>TOTAL</span>
          <b>{money(Number(sale.total))}</b>
        </div>
        {sale.payments.map((p: any) => (
          <p key={p.id}>
            {p.paymentMethod.name}: {money(Number(p.amount))}
          </p>
        ))}
        {change > 0 && <p>Vuelto: {money(change)}</p>}
        <p>¡Gracias por su compra!</p>
      </article>
    </div>
  );
}
