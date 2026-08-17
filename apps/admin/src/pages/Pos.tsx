import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Barcode,
  Calculator,
  Expand,
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
  linePrice,
  lineSubtotal,
  POS_SHORTCUTS,
  type CartLine,
  type PosProduct,
} from '../lib/pos-cart';
import type { Branch } from './Branches';
import { loadPosSettings } from '../lib/pos-settings';

type Method = { id: string; code: string; name: string; requiresReference: boolean; active?: boolean };
type Terminal = { id: string; name: string; code: string; branchId: string; active?: boolean };
type Suspended = { id: string; at: string; cart: CartLine[] };
type Modal = 'help' | 'search' | 'edit' | 'discount' | 'suspended' | 'utilities' | 'payment' | null;
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const quantity = (line: CartLine) =>
  line.isWeighted ? `${line.quantity.toLocaleString('es-AR', { minimumFractionDigits: 3 })} kg` : String(line.quantity);

export function Pos({ me, branches, branchId }: { me: Me; branches: Branch[]; branchId?: string }) {
  const scanner = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosProduct[]>([]);
  const [favorites, setFavorites] = useState<PosProduct[]>([]);
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
  const settings = loadPosSettings(branch?.id);
  const appearance = (() => {
    try {
      return JSON.parse(localStorage.getItem('system-preferences') ?? '{}') as {
        background?: string;
        backgroundOpacity?: number;
        backgroundBlur?: number;
      };
    } catch {
      return {};
    }
  })();
  const selected = cart.find((line) => line.id === selectedId);
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0), [cart]);
  const total = useMemo(() => cart.reduce((sum, line) => sum + lineSubtotal(line), 0), [cart]);
  const discount = subtotal - total;
  const focusScanner = useCallback(() => setTimeout(() => scanner.current?.focus(), 0), []);

  useEffect(() => {
    if (!branch) return;
    Promise.all([
      api<Method[]>('/payment-methods'),
      api<Terminal[]>('/terminals'),
      api<PosProduct[]>(`/pos/products/favorites?branchId=${branch.id}`),
    ])
      .then(([paymentMethods, availableTerminals, favoriteProducts]) => {
        setMethods(paymentMethods.filter((item) => item.active !== false));
        const branchTerminals = availableTerminals.filter(
          (item) => item.active !== false && item.branchId === branch.id,
        );
        setTerminals(branchTerminals);
        setTerminalId((current) =>
          branchTerminals.some((item) => item.id === current) ? current : (branchTerminals[0]?.id ?? ''),
        );
        setFavorites(favoriteProducts);
        setOnline(true);
      })
      .catch((error: Error) => {
        setOnline(false);
        setMessage({ kind: 'error', text: error.message });
      });
  }, [branch?.id]);
  useEffect(() => {
    sessionStorage.setItem('pos-cart', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem('pos-suspended-sales', JSON.stringify(suspended));
  }, [suspended]);
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
        const next = addProductToCart(cart, product, amount ?? 1);
        setCart(next);
        setSelectedId(product.id);
        setQuery('');
        setResults([]);
        setMessage({
          kind: 'ok',
          text: `${product.name} agregado · ${money(lineSubtotal(next.find((x) => x.id === product.id)!))}`,
        });
      } catch (error) {
        setMessage({ kind: 'error', text: (error as Error).message });
      }
      focusScanner();
    },
    [cart, focusScanner],
  );

  const lookup = useCallback(
    async (raw: string, addExact = true) => {
      if (!branch || !raw.trim()) return;
      const term = raw.trim();
      setBusy(true);
      setMessage(undefined);
      try {
        if (/^\d{3,64}$/.test(term)) {
          const product = await api<PosProduct>(
            `/pos/products/by-barcode/${encodeURIComponent(term)}?branchId=${branch.id}`,
          );
          setOnline(true);
          if (addExact) add(product);
          else setResults([product]);
        } else {
          const found = await api<PosProduct[]>(
            `/pos/products/search?branchId=${branch.id}&q=${encodeURIComponent(term)}`,
          );
          setOnline(true);
          setResults(found);
          if (!found.length) setMessage({ kind: 'error', text: `No encontramos productos para “${term}”.` });
          else if (found.length === 1 && found[0].internalCode.toLowerCase() === term.toLowerCase() && addExact)
            add(found[0]);
          else setModal('search');
        }
      } catch (error) {
        const text = (error as Error).message;
        if (text.includes('Sin conexión')) setOnline(false);
        setMessage({ kind: 'error', text });
      } finally {
        setBusy(false);
      }
    },
    [add, branch],
  );

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
    setSuspended((items) => [{ id: crypto.randomUUID(), at: new Date().toISOString(), cart }, ...items]);
    setCart([]);
    setSelectedId(undefined);
    setModal(null);
    setMessage({ kind: 'info', text: 'Venta suspendida' });
    focusScanner();
  }, [cart, focusScanner]);
  const openEdit = useCallback(
    (kind: Modal) => {
      if (!selected) return setMessage({ kind: 'info', text: 'Seleccioná un producto del carrito.' });
      setModal(kind);
    },
    [selected],
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
                  quantity: Math.max(line.isWeighted ? 0.001 : 1, line.quantity - (line.isWeighted ? 0.05 : 1)),
                }
              : line,
          ),
        );
      }
    };
    addEventListener('keydown', handler);
    return () => removeEventListener('keydown', handler);
  }, [add, cart.length, focusScanner, modal, openEdit, removeSelected, selected, suspend]);

  if (ticket)
    return (
      <Ticket
        sale={ticket}
        branch={branch}
        cashier={`${me.user.firstName} ${me.user.lastName}`}
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
              '--pos-background': `url(${appearance.background})`,
              '--pos-overlay': String((appearance.backgroundOpacity ?? 20) / 100),
              '--pos-blur': `${appearance.backgroundBlur ?? 0}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <header className="pos-header">
        <div>
          <b>EL RINCÓN POS</b>
          <span>
            {branch?.name ?? 'Sin sucursal'} ·{' '}
            {terminals.find((item) => item.id === terminalId)?.name ?? 'Sin terminal'}
          </span>
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
          <a href="/pos/admin">Administración</a>
        </div>
      </header>
      <main className="pos-grid">
        <section className="pos-cart">
          <div className="pos-search">
            <Barcode />
            <input
              ref={scanner}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void lookup(query)}
              placeholder="Escanear barcode o buscar nombre, código, SKU o marca (F2)"
            />
            <button disabled={busy} onClick={() => void lookup(query)}>
              <Search />
            </button>
          </div>
          {message && <div className={`pos-feedback ${message.kind}`}>{message.text}</div>}
          {!!favorites.length && (
            <div
              className="pos-favorites"
              style={{ gridTemplateColumns: `repeat(${settings.favoriteColumns}, minmax(120px, 1fr))` }}
              aria-label="Accesos rápidos"
            >
              {favorites.map((product) => (
                <button key={product.id} onClick={() => add(product)}>
                  <span>{product.shortName || product.name}</span>
                  <b>{money(Number(product.price))}</b>
                </button>
              ))}
            </div>
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
                                    line.isWeighted ? 0.001 : 1,
                                    x.quantity - (line.isWeighted ? 0.05 : 1),
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
            disabled={!cart.length || !terminalId || !online}
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
          {!terminalId && <p className="pos-warning">No hay una terminal activa para esta sucursal.</p>}
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
      {modal === 'suspended' && (
        <SuspendedModal
          sales={suspended}
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
                  items: cart.map((line) => ({
                    productId: line.id,
                    quantity: line.quantity,
                    expectedUnitPrice: line.originalPrice,
                    manualPrice: line.manualPrice,
                    discountPercent: line.discountPercent,
                    discountAmount: line.discountAmount,
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
  save: (v: { quantity: number; manualPrice?: number }) => void;
}) {
  const [qty, setQty] = useState(line && 'quantity' in line ? line.quantity : line?.isWeighted ? 0 : 1),
    [price, setPrice] = useState(line ? linePrice(line as CartLine) : 0);
  if (!line) return null;
  return (
    <ModalFrame title={line.isWeighted ? 'Ingresar peso' : 'Editar producto'} close={close}>
      <form
        className="pos-form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ quantity: qty, manualPrice: price !== Number(line.price) ? price : undefined });
        }}
      >
        <h3>{line.name}</h3>
        <label>
          {line.isWeighted ? 'Peso (kg)' : 'Cantidad'}
          <input
            autoFocus
            type="number"
            min={line.isWeighted ? '.001' : '1'}
            step={line.isWeighted ? '.001' : '1'}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
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
          Subtotal estimado <b>{money(qty * price)}</b>
        </p>
        <button className="pos-pay" disabled={qty <= 0}>
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
                <small>{s.cart.length} renglones</small>
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
  const paid = rows.reduce((n, x) => n + Number(x.amount || 0), 0),
    remaining = Math.round((total - paid) * 100) / 100;
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
      {rows.map((row, index) => (
        <div className="payment-row" key={index}>
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
          <input
            type="number"
            value={row.receivedAmount}
            onChange={(e) =>
              setRows(rows.map((x, i) => (i === index ? { ...x, receivedAmount: Number(e.target.value) } : x)))
            }
            placeholder="Recibido / referencia"
          />
        </div>
      ))}
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
      <button className="pos-pay" disabled={busy || remaining !== 0} onClick={() => void confirm(rows)}>
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
          Nueva venta
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          Imprimir ticket
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
