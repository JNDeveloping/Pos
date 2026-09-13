import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Boxes, ChevronLeft, ChevronRight, History, PackageCheck, Search } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';

type StockRow = {
  id: string;
  branchId: string;
  productId: string;
  quantity: string;
  reservedQuantity: string;
  inTransitQuantity: string;
  availableQuantity: number;
  minimumStock: number;
  status: string;
  stockValue: number;
  product: { internalCode: string; name: string; category?: { name: string }; brand?: { name: string } };
  branch?: { id: string; name: string };
};
type StockPage = { data: StockRow[]; meta: { page: number; pages: number; total: number } };
type Movement = { id: string; type: string; quantity: string; reason?: string; createdAt: string; previousQuantity: string; newQuantity: string };
export function Stock() {
  const [rows, setRows] = useState<StockRow[]>([]),
    [search, setSearch] = useState(''),
    [loading, setLoading] = useState(true), [error, setError] = useState(''), [page, setPage] = useState(1), [pages, setPages] = useState(1), [totalRows, setTotalRows] = useState(0), [movements, setMovements] = useState<Movement[]>(),
    [adjusting, setAdjusting] = useState<StockRow>();
  const load = useCallback(async (requestedPage = page) => {
    setLoading(true);
    setError('');
    try {
      const result = await api<StockPage>(`/stock?paged=true&page=${requestedPage}&branchId=${branchContext.get() ?? ''}&search=${encodeURIComponent(search)}`);
      setRows(result.data); setPages(result.meta.pages || 1); setTotalRows(result.meta.total);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, page, search]);
  const total = rows.reduce((sum, row) => sum + row.stockValue, 0),
    low = rows.filter((x) => x.status !== 'NORMAL').length;
  return (
    <div className="space-y-5">
      <header className="page-heading">
        <div>
          <p className="eyebrow">INVENTARIO</p>
          <h1>Stock por sucursal</h1>
          <p>Existencias físicas, reservas, tránsito y valorización en una sola vista.</p>
        </div>
      </header>
      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error} <button className="ml-2 underline" onClick={() => void load()}>Reintentar</button></div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <StockMetric icon={<Boxes />} label="Productos controlados" value={String(rows.length)} />
        <StockMetric icon={<AlertTriangle />} label="Requieren atención" value={String(low)} />
        <StockMetric icon={<PackageCheck />} label="Valor estimado" value={`$${total.toLocaleString('es-AR')}`} />
      </div>
      <section className="card overflow-hidden">
        <div className="toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); void load(1); } }}
              placeholder="Producto, código o barcode"
            />
          </label>
          <button className="btn-secondary" onClick={() => { setPage(1); void load(1); }}>
            Buscar
          </button>
          <button className="btn-secondary" onClick={() => void api<{ data: Movement[] }>(`/stock/movements?branchId=${branchContext.get() ?? ''}`).then((result) => setMovements(result.data)).catch((reason: Error) => setError(reason.message))}><History size={17}/>Historial</button>
        </div>
        {loading ? (
          <div className="empty-state">Cargando stock…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Boxes size={42} />
            <h2>No hay stock registrado</h2>
            <p>Usá “Ajustar stock” o confirmá una compra para generar el primer movimiento.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código / producto</th>
                  <th>Actual</th>
                  <th>Reservado</th>
                  <th>Disponible</th>
                  <th>En tránsito</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.product.name}</b>
                      <small className="block text-slate-500">
                        {row.product.internalCode} · {row.product.category?.name ?? 'Sin categoría'}{row.branch?.name ? ` · ${row.branch.name}` : ''}
                      </small>
                    </td>
                    <td>{row.quantity}</td>
                    <td>{row.reservedQuantity}</td>
                    <td className="font-bold">{row.availableQuantity}</td>
                    <td>{row.inTransitQuantity}</td>
                    <td>{row.minimumStock}</td>
                    <td>
                      <span className={`badge ${row.status === 'NORMAL' ? 'badge-success' : 'badge-warning'}`}>
                        {row.status === 'OUT_OF_STOCK' ? 'SIN STOCK' : row.status === 'LOW' ? 'BAJO' : 'NORMAL'}
                      </span>
                    </td>
                    <td>
                      <button className="icon-button" title="Ajustar stock" onClick={() => setAdjusting(row)}>
                        <ArrowDownUp size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex items-center justify-between border-t p-4 text-sm"><span>{totalRows.toLocaleString('es-AR')} productos</span><div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft/></button><span>Página {page} de {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight/></button></div></footer>
      </section>
      {movements && <div className="modal-backdrop"><section className="modal-card max-w-3xl"><div className="flex justify-between"><div><h2>Últimos movimientos</h2><p className="text-slate-500">Historial auditable de la sucursal activa.</p></div><button onClick={() => setMovements(undefined)}>Cerrar</button></div><div className="mt-4 max-h-[60vh] divide-y overflow-y-auto">{movements.map((movement) => <article className="py-3" key={movement.id}><div className="flex justify-between"><b>{movement.type}</b><time className="text-sm text-slate-500">{new Date(movement.createdAt).toLocaleString('es-AR')}</time></div><p className="text-sm">{movement.previousQuantity} → {movement.newQuantity} · {movement.quantity} {movement.reason ? `· ${movement.reason}` : ''}</p></article>)}{!movements.length && <p className="empty-state">No hay movimientos registrados.</p>}</div></section></div>}
      {adjusting && (
        <Adjustment
          row={adjusting}
          close={() => setAdjusting(undefined)}
          saved={async () => {
            setAdjusting(undefined);
            await load();
          }}
        />
      )}
    </div>
  );
}
function StockMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <b className="mt-2 block text-3xl font-bold text-slate-900">{value}</b>
        </div>
        <span className="metric-icon">{icon}</span>
      </div>
    </article>
  );
}
function Adjustment({ row, close, saved }: { row: StockRow; close: () => void; saved: () => Promise<void> }) {
  const [mode, setMode] = useState('INCREASE'),
    [quantity, setQuantity] = useState(''),
    [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop">
      <form
        className="modal-card"
        onSubmit={async (e) => {
          e.preventDefault();
          await api('/stock/adjust', {
            method: 'POST',
            body: JSON.stringify({
              branchId: row.branchId,
              productId: row.productId,
              mode,
              quantity: Number(quantity),
              reason,
            }),
          });
          await saved();
        }}
      >
        <h2>Ajustar {row.product.name}</h2>
        <p className="text-slate-500">Todo ajuste crea un movimiento auditable.</p>
        <label>
          Operación
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="INCREASE">Sumar</option>
            <option value="DECREASE">Restar</option>
            <option value="SET">Establecer cantidad</option>
            <option value="INITIAL">Carga inicial</option>
          </select>
        </label>
        <label>
          Cantidad
          <input
            type="number"
            min="0"
            step="0.001"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label>
          Motivo
          <input
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Corrección por conteo"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={close}>
            Cancelar
          </button>
          <button className="btn-primary">Confirmar ajuste</button>
        </div>
      </form>
    </div>
  );
}
