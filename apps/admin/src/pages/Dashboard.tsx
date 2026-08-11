import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  FolderTree,
  Package,
  PackageCheck,
  RefreshCw,
  Tags,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { appPath } from '../lib/navigation';
type S = {
  products: number;
  activeProducts: number;
  activeBranches: number;
  activeUsers: number;
  categories: number;
  productsWithoutPrice: number;
  productsWithoutCost: number;
  productsWithoutBarcode: number;
  lowMargin: number;
  pricesChangedToday: number;
  productsWithoutBranchConfig: number;
  enabledInBranch: number;
};
type Metric = { label: string; value: number | undefined; icon: LucideIcon; tone: string; hint: string };
export function Dashboard() {
  const [s, setS] = useState<S>(),
    [error, setError] = useState(''),
    [refreshing, setRefreshing] = useState(false);
  async function load() {
    setRefreshing(true);
    setError('');
    try {
      const branchId = branchContext.get();
      setS(await api<S>(`/dashboard/summary${branchId ? `?branchId=${branchId}` : ''}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen');
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const cards: Metric[] = [
    {
      label: 'Productos en catálogo',
      value: s?.products,
      icon: Package,
      tone: 'bg-blue-50 text-blue-600',
      hint: `${s?.activeProducts ?? 0} activos`,
    },
    {
      label: 'Habilitados en sucursal',
      value: s?.enabledInBranch,
      icon: PackageCheck,
      tone: 'bg-emerald-50 text-emerald-600',
      hint: 'Listos para comercializar',
    },
    {
      label: 'Sucursales activas',
      value: s?.activeBranches,
      icon: Building2,
      tone: 'bg-violet-50 text-violet-600',
      hint: 'Organización actual',
    },
    {
      label: 'Usuarios activos',
      value: s?.activeUsers,
      icon: Users,
      tone: 'bg-amber-50 text-amber-600',
      hint: 'Con acceso al sistema',
    },
  ];
  const alerts = [
    ['Productos sin precio', s?.productsWithoutPrice, '/prices'],
    ['Productos sin costo', s?.productsWithoutCost, '/costs'],
    ['Productos sin barcode', s?.productsWithoutBarcode, '/products'],
    ['Margen debajo del mínimo', s?.lowMargin, '/prices'],
  ];
  const quality = [
    ['Con precio', (s?.enabledInBranch ?? 0) - (s?.productsWithoutPrice ?? 0), s?.enabledInBranch],
    ['Con costo', (s?.enabledInBranch ?? 0) - (s?.productsWithoutCost ?? 0), s?.enabledInBranch],
    ['Con barcode', (s?.products ?? 0) - (s?.productsWithoutBarcode ?? 0), s?.products],
  ] as const;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-brand-600">Resumen general</p>
          <h1 className="text-3xl font-bold">Panel administrativo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Visión operativa del catálogo y la organización, actualizada desde el servidor.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => void load()} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>
      {error && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="shrink-0" size={20} />
          <span>{error}</span>
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone, hint }) => (
          <article className="metric-card" key={label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                {value === undefined ? (
                  <div className="skeleton mt-3 h-9 w-24" />
                ) : (
                  <b className="mt-2 block text-3xl font-bold text-slate-900">{value.toLocaleString('es-AR')}</b>
                )}
              </div>
              <span className={`metric-icon ${tone}`}>
                <Icon size={20} />
              </span>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <CheckCircle2 size={14} className="text-emerald-500" />
              {hint}
            </p>
          </article>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <article className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">Calidad del catálogo</h2>
              <p className="mt-1 text-sm text-slate-500">Completitud de los datos necesarios para operar.</p>
            </div>
            <FolderTree className="text-brand-500" />
          </div>
          <div className="mt-7 space-y-6">
            {quality.map(([label, current, total]) => {
              const percent = total ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
              return (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <b>{percent}%</b>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {Math.max(0, current).toLocaleString('es-AR')} de {(total ?? 0).toLocaleString('es-AR')} productos
                  </p>
                </div>
              );
            })}
          </div>
        </article>
        <article className="card overflow-hidden">
          <div className="border-b p-5">
            <h2 className="font-bold">Requieren atención</h2>
            <p className="mt-1 text-sm text-slate-500">Pendientes de configuración comercial.</p>
          </div>
          <div>
            {alerts.map(([label, value, to]) => (
              <a
                href={appPath(String(to))}
                className="flex items-center gap-3 border-b px-5 py-4 transition hover:bg-slate-50"
                key={label}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-lg ${Number(value) > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}
                >
                  {Number(value) > 0 ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                </span>
                <span className="flex-1 text-sm font-medium">{label}</span>
                <b>{value ?? '—'}</b>
                <ArrowRight size={15} className="text-slate-300" />
              </a>
            ))}
          </div>
          <div className="bg-slate-50 px-5 py-4 text-sm">
            <span className="text-slate-500">Precios modificados hoy</span>
            <b className="float-right text-brand-600">{s?.pricesChangedToday ?? '—'}</b>
          </div>
        </article>
      </section>
      {s?.productsWithoutBranchConfig ? (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <Tags size={20} />
          <b>{s.productsWithoutBranchConfig}</b> productos todavía no tienen configuración por sucursal.
        </div>
      ) : null}
    </div>
  );
}
