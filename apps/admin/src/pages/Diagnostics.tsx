import { Database, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API, api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { connectivityService, type ConnectivityState } from '../services/connectivity.service';

type Branch = { id: string; name: string };

export function Diagnostics() {
  const [state, setState] = useState<ConnectivityState>(connectivityService.current);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scope, setScope] = useState('No registrado');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const unsubscribe = connectivityService.subscribe(setState);
    void api<Branch[]>('/branches').then(setBranches).catch(() => undefined);
    void navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL).then((registration) => {
      if (registration) setScope(registration.scope);
    });
    return unsubscribe;
  }, []);
  const selected = branches.find((branch) => branch.id === branchContext.get());
  return <>
    <h1 className="text-3xl font-bold">Configuración y diagnóstico</h1>
    <p className="mt-2 text-slate-500">Estado del frontend, la API y el contenedor PWA.</p>
    <section className="mt-7 grid gap-5 lg:grid-cols-2">
      <article className="card p-6">
        <div className="flex items-center gap-3"><Server className="text-brand-600" /><h2 className="text-lg font-bold">Conexión</h2></div>
        <dl className="mt-5 grid gap-4 text-sm">
          <div><dt className="text-slate-500">Modo operativo</dt><dd className="font-semibold">100% online</dd></div>
          <div><dt className="text-slate-500">API</dt><dd className="break-all">{API}</dd></div>
          <div><dt className="text-slate-500">Estado</dt><dd className="font-semibold">{state}</dd></div>
          <div><dt className="text-slate-500">Sucursal actual</dt><dd>{selected?.name ?? 'Todas / sin selección'}</dd></div>
        </dl>
        <button className="btn mt-5" onClick={async () => {
          const result = await connectivityService.check();
          setMessage(result === 'ONLINE' ? 'La API respondió correctamente.' : 'La API no está disponible.');
        }}><RefreshCw size={17} /> Comprobar API</button>
      </article>
      <article className="card p-6">
        <div className="flex items-center gap-3"><Database className="text-brand-600" /><h2 className="text-lg font-bold">Aplicación</h2></div>
        <dl className="mt-5 grid gap-4 text-sm">
          <div><dt className="text-slate-500">Versión</dt><dd>{__APP_VERSION__}</dd></div>
          <div><dt className="text-slate-500">Service Worker scope</dt><dd className="break-all">{scope}</dd></div>
          <div><dt className="text-slate-500">Datos comerciales en IndexedDB</dt><dd>Deshabilitados</dd></div>
          <div><dt className="text-slate-500">Sincronización offline</dt><dd>Deshabilitada</dd></div>
        </dl>
        <button className="btn-secondary mt-5" onClick={async () => {
          const registration = await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL);
          await registration?.update();
          setMessage('Se comprobó si existe una actualización de la aplicación.');
        }}><RefreshCw size={17} /> Buscar actualización</button>
      </article>
    </section>
    {message && <p className="mt-5 rounded-xl bg-brand-50 p-4 text-brand-700">{message}</p>}
  </>;
}
