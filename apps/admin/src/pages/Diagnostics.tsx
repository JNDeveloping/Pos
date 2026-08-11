import { Database, HardDrive, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { deviceConfig, saveDeviceConfig, type DeviceConfig } from '../offline/db/device';
import { offlineDb } from '../offline/db/database';
import { connectivityService } from '../offline/connectivity/connectivity.service';
import { syncService } from '../offline/sync/sync.service';
import type { SyncState } from '../offline/sync/sync.service';
type Branch = { id: string; name: string };
type Stats = Awaited<ReturnType<typeof syncService.storage>>;
export function Diagnostics() {
  const [device, setDevice] = useState<DeviceConfig>(),
    [branches, setBranches] = useState<Branch[]>([]),
    [stats, setStats] = useState<Stats>(),
    [message, setMessage] = useState(''),
    [sync, setSync] = useState<SyncState>();
  const load = async () => {
    setDevice(await deviceConfig());
    setStats(await syncService.storage());
    try {
      setBranches(await api<Branch[]>('/branches'));
    } catch {
      setBranches(await offlineDb.branches.toArray());
    }
  };
  useEffect(() => {
    void load();
    return syncService.subscribe(setSync);
  }, []);
  useEffect(() => {
    if (!device || branches.length !== 1 || device.branchId === branches[0].id) return;
    const updated = { ...device, branchId: branches[0].id };
    setDevice(updated);
    void saveDeviceConfig(updated);
  }, [branches, device]);
  if (!device) return null;
  return (
    <>
      <h1 className="text-3xl font-bold">Configuración y diagnóstico</h1>
      <p className="mt-2 text-slate-500">Estado de esta instalación PWA y sus datos offline.</p>
      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <article className="card p-6">
          <div className="flex items-center gap-3">
            <HardDrive className="text-brand-600" />
            <h2 className="text-lg font-bold">Dispositivo</h2>
          </div>
          <p className="mt-4">
            <span className="badge">
              {sync?.status === 'SYNCING'
                ? 'PREPARANDO'
                : (stats?.products ?? 0) > 0 && sync?.lastSuccessfulSync
                  ? 'LISTO'
                  : 'NO PREPARADO'}
            </span>
          </p>
          <dl className="mt-5 grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Device ID</dt>
              <dd className="break-all font-mono">{device.deviceId}</dd>
            </div>
            <label className="grid gap-2 font-semibold">
              Nombre
              <input value={device.name} onChange={(e) => setDevice({ ...device, name: e.target.value })} />
            </label>
            {branches.length > 1 ? (
              <label className="grid gap-2 font-semibold">
                Sucursal
                <select
                  value={device.branchId ?? ''}
                  onChange={(e) => setDevice({ ...device, branchId: e.target.value || undefined })}
                >
                  <option value="">Todas / administración</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div>
                <dt className="text-slate-500">Sucursal</dt>
                <dd className="font-semibold">{branches[0]?.name ?? 'Sin sucursal activa'}</dd>
              </div>
            )}
          </dl>
          <button
            className="btn mt-5"
            onClick={async () => {
              await saveDeviceConfig(device);
              setMessage('Configuración guardada. Preparando datos de la sucursal…');
              await syncService.sync();
              await load();
              setMessage(
                connectivityService.current === 'ONLINE'
                  ? 'Dispositivo preparado para trabajar sin conexión.'
                  : 'Vínculo guardado. Los datos se descargarán al recuperar conexión.',
              );
            }}
          >
            <Save size={17} />
            Guardar vínculo
          </button>
          <button
            className="btn-secondary mt-3"
            onClick={async () => {
              setMessage('Preparando dispositivo para uso offline…');
              await syncService.rebuild();
              await load();
              setMessage('Dispositivo preparado para uso offline.');
            }}
          >
            <RefreshCw size={17} /> Preparar dispositivo para uso offline
          </button>
        </article>
        <article className="card p-6">
          <div className="flex items-center gap-3">
            <Database className="text-brand-600" />
            <h2 className="text-lg font-bold">Datos locales</h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {stats &&
              Object.entries(stats)
                .filter(([k]) => !['usage', 'quota'].includes(k))
                .map(([k, v]) => (
                  <div className="rounded-xl bg-slate-50 p-3" key={k}>
                    <small className="text-slate-500">{k}</small>
                    <b className="block text-xl">{v}</b>
                  </div>
                ))}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Uso estimado: {((stats?.usage ?? 0) / 1024 / 1024).toFixed(2)} MB
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div>
              <dt className="text-slate-500">API</dt>
              <dd>{['ONLINE', 'SYNCING'].includes(sync?.status ?? '') ? 'Disponible' : 'No disponible'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Última sincronización</dt>
              <dd>{sync?.lastSuccessfulSync ? new Date(sync.lastSuccessfulSync).toLocaleString('es-AR') : 'Nunca'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Operaciones pendientes</dt>
              <dd>{sync?.pending ?? 0}</dd>
            </div>
          </dl>
          <button
            className="btn mt-5"
            onClick={async () => {
              await syncService.sync();
              await load();
            }}
          >
            <RefreshCw size={17} /> Sincronizar ahora
          </button>
          <button
            className="btn-secondary mt-5"
            onClick={async () => {
              if (confirm('Se volverán a descargar los catálogos. La cola pendiente se conservará.')) {
                setMessage('Reconstruyendo datos locales…');
                await syncService.rebuild();
                await load();
                setMessage('Datos locales reconstruidos.');
              }
            }}
          >
            <RefreshCw size={17} />
            Reconstruir datos locales
          </button>
        </article>
      </section>
      {message && <p className="mt-5 rounded-xl bg-brand-50 p-4 text-brand-700">{message}</p>}
      <p className="mt-5 text-xs text-slate-400">Versión PWA: {__APP_VERSION__}</p>
    </>
  );
}
