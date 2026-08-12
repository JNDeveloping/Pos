import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Barcode, Minus, Pause, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { api, type Me } from '../lib/api';
import type { Branch } from './Branches';

type Product = {
  id: string;
  branchProductId: string;
  name: string;
  internalCode: string;
  barcode?: string;
  price: string;
  available: number;
  isWeighted: boolean;
  posFavorite: boolean;
};
type Line = Product & { quantity: number };
type Method = { id: string; code: string; name: string; requiresReference: boolean };
type Terminal = { id: string; name: string; code: string; branchId: string };
type Suspended = { id: string; at: string; cart: Line[] };
export function Pos({ me, branches, branchId }: { me: Me; branches: Branch[]; branchId?: string }) {
  const input = useRef<HTMLInputElement>(null),
    [query, setQuery] = useState(''),
    [products, setProducts] = useState<Product[]>([]),
    [cart, setCart] = useState<Line[]>([]),
    [methods, setMethods] = useState<Method[]>([]),
    [terminals, setTerminals] = useState<Terminal[]>([]),
    [terminalId, setTerminalId] = useState(''),
    [paying, setPaying] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [ticket, setTicket] = useState<any>();
  const [suspended, setSuspended] = useState<Suspended[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pos-suspended-sales') ?? '[]') as Suspended[];
    } catch {
      return [];
    }
  });
  const branch = branches.find((b) => b.id === branchId) ?? branches[0];
  useEffect(() => {
    if (!branch) return;
    Promise.all([
      api<Method[]>('/payment-methods'),
      api<Terminal[]>('/terminals'),
      api<Product[]>(`/pos/products?branchId=${branch.id}`),
    ])
      .then(([m, t, p]) => {
        setMethods(m.filter((x) => (x as any).active !== false));
        setTerminals(t.filter((x) => (x as any).active !== false));
        setTerminalId(t[0]?.id ?? '');
        setProducts(p);
      })
      .catch((e) => setMessage(e.message));
  }, [branch?.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length) setPaying(true);
      }
      if (e.key === 'F8' && cart.length) {
        e.preventDefault();
        setSuspended((current) => [...current, { id: crypto.randomUUID(), at: new Date().toISOString(), cart }]);
        setCart([]);
        setMessage('Venta suspendida');
      }
      if (e.key === 'Escape') setPaying(false);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [cart.length]);
  useEffect(() => localStorage.setItem('pos-suspended-sales', JSON.stringify(suspended)), [suspended]);
  const total = useMemo(() => cart.reduce((n, x) => n + Number(x.price) * x.quantity, 0), [cart]);
  const add = (p: Product) => {
    const existing = cart.find((x) => x.id === p.id),
      next = (existing?.quantity ?? 0) + 1;
    if (next > p.available) {
      setMessage(`Stock insuficiente de ${p.name}`);
      return;
    }
    setCart(
      existing ? cart.map((x) => (x.id === p.id ? { ...x, quantity: next } : x)) : [...cart, { ...p, quantity: 1 }],
    );
    setMessage(`${p.name} agregado`);
    setQuery('');
    setTimeout(() => input.current?.focus());
  };
  const search = async () => {
    if (!branch || !query.trim()) return;
    try {
      const found = await api<Product[]>(`/pos/products?branchId=${branch.id}&q=${encodeURIComponent(query.trim())}`);
      setProducts(found);
      const exact = found.find((x) => x.barcode === query.trim() || x.internalCode === query.trim());
      if (exact) add(exact);
      else if (!found.length) setMessage('Producto no encontrado');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  if (ticket)
    return (
      <Ticket
        sale={ticket}
        branch={branch}
        cashier={`${me.user.firstName} ${me.user.lastName}`}
        next={() => {
          setTicket(undefined);
          setCart([]);
          setTimeout(() => input.current?.focus());
        }}
      />
    );
  return (
    <div className="pos-shell">
      <header className="pos-header">
        <div>
          <b>El Rincón POS</b>
          <span>
            {branch?.name ?? 'Seleccioná sucursal'} ·{' '}
            {terminals.find((x) => x.id === terminalId)?.name ?? 'Sin terminal'}
          </span>
        </div>
        <a href="/pos/admin">Administración</a>
      </header>
      <main className="pos-grid">
        <section className="pos-cart">
          <div className="pos-search">
            <Barcode />
            <input
              ref={input}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              placeholder="Escanear código o buscar producto (F2)"
            />
            <button onClick={() => void search()}>
              <Search />
            </button>
          </div>
          {message && <div className="pos-feedback">{message}</div>}
          <div className="pos-favorites">
            {products
              .filter((x) => x.posFavorite)
              .slice(0, 8)
              .map((p) => (
                <button key={p.id} onClick={() => add(p)}>
                  {p.name}
                  <b>${Number(p.price).toLocaleString('es-AR')}</b>
                </button>
              ))}
          </div>
          <div className="pos-lines">
            {cart.length === 0 ? (
              <div className="pos-empty">
                <ShoppingCart size={50} />
                <h2>Venta nueva</h2>
                <p>Escaneá o buscá el primer producto.</p>
              </div>
            ) : (
              cart.map((line) => (
                <article key={line.id}>
                  <div>
                    <b>{line.name}</b>
                    <small>
                      {line.internalCode} · ${Number(line.price).toLocaleString('es-AR')} c/u
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
                    <input
                      type="number"
                      step={line.isWeighted ? '.001' : '1'}
                      value={line.quantity}
                      onChange={(e) =>
                        setCart(cart.map((x) => (x.id === line.id ? { ...x, quantity: Number(e.target.value) } : x)))
                      }
                    />
                    <button onClick={() => add(line)}>
                      <Plus />
                    </button>
                  </div>
                  <strong>${(Number(line.price) * line.quantity).toLocaleString('es-AR')}</strong>
                  <button className="pos-delete" onClick={() => setCart(cart.filter((x) => x.id !== line.id))}>
                    <Trash2 />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="pos-summary">
          <p>RESUMEN</p>
          <dl>
            <div>
              <dt>Productos</dt>
              <dd>{cart.reduce((n, x) => n + x.quantity, 0)}</dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>${total.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt>Descuentos</dt>
              <dd>$0</dd>
            </div>
          </dl>
          <div className="pos-total">
            <span>TOTAL</span>
            <b>${total.toLocaleString('es-AR')}</b>
          </div>
          <button className="pos-pay" disabled={!cart.length || !terminalId} onClick={() => setPaying(true)}>
            <Banknote /> COBRAR <kbd>F4</kbd>
          </button>
          <button
            className="pos-secondary"
            onClick={() => {
              if (confirm('¿Cancelar la venta actual?')) setCart([]);
            }}
          >
            <X /> Cancelar venta
          </button>
          <button
            className="pos-secondary"
            disabled={!cart.length}
            onClick={() => {
              setSuspended([...suspended, { id: crypto.randomUUID(), at: new Date().toISOString(), cart }]);
              setCart([]);
              setMessage('Venta suspendida');
            }}
          >
            <Pause /> Suspender venta (F8)
          </button>
          {suspended.map((sale) => (
            <button
              key={sale.id}
              className="pos-secondary"
              onClick={() => {
                setCart(sale.cart);
                setSuspended(suspended.filter((item) => item.id !== sale.id));
                setMessage(`Venta de ${new Date(sale.at).toLocaleTimeString('es-AR')} recuperada`);
              }}
            >
              Recuperar {new Date(sale.at).toLocaleTimeString('es-AR')} · {sale.cart.length} ítems
            </button>
          ))}
        </aside>
      </main>
      {paying && (
        <PaymentModal
          total={total}
          methods={methods}
          busy={busy}
          close={() => setPaying(false)}
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
                  items: cart.map((x) => ({
                    productId: x.id,
                    quantity: x.quantity,
                    expectedUnitPrice: Number(x.price),
                  })),
                  payments,
                }),
              });
              setPaying(false);
              setTicket(sale);
            } catch (e) {
              setMessage((e as Error).message);
              setPaying(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
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
  confirm: (p: any[]) => Promise<void>;
}) {
  const [rows, setRows] = useState([
    { paymentMethodId: methods[0]?.id ?? '', amount: total, receivedAmount: total, reference: '' },
  ]);
  const paid = rows.reduce((n, x) => n + Number(x.amount || 0), 0),
    remaining = Math.round((total - paid) * 100) / 100,
    change = rows.reduce((sum, row) => {
      const cash = methods.find((method) => method.id === row.paymentMethodId)?.code === 'CASH';
      return sum + (cash ? Math.max(0, Number(row.receivedAmount) - Number(row.amount)) : 0);
    }, 0);
  return (
    <div className="pos-modal">
      <div className="pos-payment">
        <button className="pos-modal-close" onClick={close}>
          <X />
        </button>
        <p>COBRO</p>
        <h2>${total.toLocaleString('es-AR')}</h2>
        {rows.map((r, i) => (
          <div className="payment-row" key={i}>
            <select
              value={r.paymentMethodId}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, paymentMethodId: e.target.value } : x)))}
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={r.amount}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))}
              placeholder="Monto"
            />
            {methods.find((method) => method.id === r.paymentMethodId)?.code === 'CASH' ? (
              <input
                type="number"
                value={r.receivedAmount}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (j === i ? { ...x, receivedAmount: Number(e.target.value) } : x)))
                }
                placeholder="Efectivo recibido"
              />
            ) : (
              <input
                value={r.reference}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))}
                placeholder="Referencia"
              />
            )}
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
          <b>${remaining.toLocaleString('es-AR')}</b>
        </div>
        {change > 0 && (
          <div className="payment-remaining">
            <span>Vuelto</span>
            <b>${change.toLocaleString('es-AR')}</b>
          </div>
        )}
        <button className="pos-pay" disabled={busy || remaining !== 0} onClick={() => void confirm(rows)}>
          {busy ? 'Procesando…' : 'CONFIRMAR VENTA'}
        </button>
      </div>
    </div>
  );
}
function Ticket({ sale, branch, cashier, next }: { sale: any; branch?: Branch; cashier: string; next: () => void }) {
  return (
    <div className="ticket-screen">
      <div className="ticket-actions">
        <button className="btn-secondary" onClick={next}>
          Siguiente venta
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
              {x.productNameSnapshot} x {x.quantity}
            </span>
            <b>${Number(x.subtotal).toLocaleString('es-AR')}</b>
          </div>
        ))}
        <hr />
        <div className="ticket-grand">
          <span>TOTAL</span>
          <b>${Number(sale.total).toLocaleString('es-AR')}</b>
        </div>
        {sale.payments.map((p: any) => (
          <p key={p.id}>
            {p.paymentMethod.name}: ${Number(p.amount).toLocaleString('es-AR')}
          </p>
        ))}
        <p>¡Gracias por su compra!</p>
      </article>
    </div>
  );
}
