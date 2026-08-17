import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Boxes, PackageCheck, Search } from 'lucide-react';
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
};
export function Stock() {
  const [rows, setRows] = useState<StockRow[]>([]),
    [search, setSearch] = useState(''),
    [loading, setLoading] = useState(true),
    [adjusting, setAdjusting] = useState<StockRow>();
  const load = async () => {
    setLoading(true);
    try {
      setRows(
        await api<StockRow[]>(`/stock?branchId=${branchContext.get() ?? ''}&search=${encodeURIComponent(search)}`),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
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
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void load()}
              placeholder="Producto, código o barcode"
            />
          </label>
          <button className="btn-secondary" onClick={() => void load()}>
            Buscar
          </button>
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
                        {row.product.internalCode} · {row.product.category?.name ?? 'Sin categoría'}
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
      </section>
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
