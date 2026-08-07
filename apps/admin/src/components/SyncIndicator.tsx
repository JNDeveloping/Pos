import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { syncService, type SyncState } from '../offline/sync/sync.service';
const labels = {
  ONLINE: 'Online',
  OFFLINE: 'Sin conexión',
  SERVER_UNAVAILABLE: 'Servidor no disponible',
  SYNCING: 'Sincronizando…',
  SYNC_ERROR: 'Error de sincronización',
};
const colors = {
  ONLINE: 'bg-emerald-50 text-emerald-700',
  OFFLINE: 'bg-amber-50 text-amber-700',
  SERVER_UNAVAILABLE: 'bg-orange-50 text-orange-700',
  SYNCING: 'bg-blue-50 text-blue-700',
  SYNC_ERROR: 'bg-red-50 text-red-700',
};
export function SyncIndicator() {
  const [state, setState] = useState<SyncState>({ status: 'SERVER_UNAVAILABLE', pending: 0 });
  useEffect(() => syncService.subscribe(setState), []);
  const Icon =
    state.status === 'ONLINE'
      ? Cloud
      : state.status === 'SYNCING'
        ? RefreshCw
        : state.status === 'SYNC_ERROR'
          ? TriangleAlert
          : CloudOff;
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${colors[state.status]}`} title={state.error}>
          <span className="flex items-center gap-2">
            <Icon size={15} className={state.status === 'SYNCING' ? 'animate-spin' : ''} />
            {state.progress ?? labels[state.status]}
          </span>
          <span className="mt-0.5 block font-normal opacity-75">
            {state.lastSuccessfulSync
              ? `Última: ${new Date(state.lastSuccessfulSync).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Sin sincronizar'}{' '}
            · Pendientes: {state.pending}
          </span>
        </div>
        <button
          aria-label="Sincronizar ahora"
          className="btn-secondary min-h-11 px-3 py-2 text-xs"
          onClick={() => void syncService.sync()}
          disabled={state.status === 'SYNCING'}
        >
          <RefreshCw size={16} /> <span className="hidden sm:inline">Sincronizar ahora</span>
        </button>
      </div>
      {['OFFLINE', 'SERVER_UNAVAILABLE'].includes(state.status) && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 z-40 rounded-xl bg-amber-100 p-3 text-center text-sm font-medium text-amber-900 shadow-lg sm:left-auto sm:max-w-md"
        >
          Sin conexión. Estás trabajando con los datos disponibles en este dispositivo.
        </div>
      )}
    </>
  );
}
