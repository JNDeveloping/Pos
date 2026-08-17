import { FormEvent, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { auditActionLabel, auditNarrative } from '../lib/audit-labels';
type Log = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user: { firstName: string; lastName: string; username: string };
  branch?: { name: string };
};
type Page = { data: Log[]; meta: { total: number } };
export function Audit() {
  const [result, setResult] = useState<Page>(),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const load = () =>
    api<Page>(`/audit?action=${encodeURIComponent(query)}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <h1 className="text-3xl font-bold">Auditoría</h1>
      <p className="mt-2 text-slate-500">Trazabilidad de operaciones críticas, limitada a la empresa autenticada.</p>
      <form
        className="card mt-6 flex gap-3 p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void load();
        }}
      >
        <Search className="self-center" />
        <input
          className="flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por código de acción"
        />
        <button className="btn-secondary">Filtrar</button>
      </form>
      {error && <p className="mt-4 text-red-700">{error}</p>}
      <div className="mt-5 space-y-3">
        {result?.data.map((log) => (
          <article className="card p-5" key={log.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <b>{auditActionLabel(log.action)}</b>
                <p className="text-sm text-slate-500">
                  {log.entityType} · {log.branch?.name ?? 'General'}
                </p>
              </div>
              <time className="text-sm text-slate-500">{new Date(log.createdAt).toLocaleString('es-AR')}</time>
            </div>
            <p className="mt-3 text-sm">{auditNarrative(log)}</p>
            <p className="mt-2 text-xs text-slate-500">
              Usuario: {log.user.firstName} {log.user.lastName} ({log.user.username})
            </p>
            {log.before && log.after && (
              <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-2">
                <div>
                  <b>Antes</b>
                  <p>
                    Precio: {String(log.before.salePrice ?? '—')} · Costo: {String(log.before.cost ?? '—')}
                  </p>
                </div>
                <div>
                  <b>Después</b>
                  <p>
                    Precio: {String(log.after.salePrice ?? '—')} · Costo: {String(log.after.cost ?? '—')}
                  </p>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
