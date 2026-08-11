import { FormEvent, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { brandRepository, categoryRepository } from '../offline/repositories/domain.repositories';
type Item = { id: string; name: string; code?: string; active: boolean };
export function SimpleCrud({
  title,
  path,
  withCode = false,
  readOnly = false,
}: {
  title: string;
  path: string;
  withCode?: boolean;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [name, setName] = useState(''),
    [code, setCode] = useState('');
  const repository = path === '/categories' ? categoryRepository : path === '/brands' ? brandRepository : undefined;
  const load = async () => {
    if (repository) setItems((await repository.local()) as Item[]);
    try {
      setItems(await api<Item[]>(path));
    } catch {
      /* Local data remains visible offline. */
    }
  };
  useEffect(() => {
    void load();
  }, [path]);
  async function add(e: FormEvent) {
    e.preventDefault();
    await api(path, { method: 'POST', body: JSON.stringify({ name, ...(withCode ? { code } : {}) }) });
    setName('');
    setCode('');
    load();
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-slate-500">Administrá los registros disponibles para la empresa.</p>
        </div>
      </div>
      {!readOnly && (
        <form onSubmit={add} className="card mt-7 flex flex-wrap gap-3 p-4">
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          {withCode && <input placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} required />}
          <button className="btn">
            <Plus size={18} />
            Agregar
          </button>
        </form>
      )}
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-4">Nombre</th>
              {withCode && <th>Código</th>}
              <th>Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr className="border-b last:border-0" key={x.id}>
                <td className="p-4 font-semibold">{x.name}</td>
                {withCode && <td>{x.code}</td>}
                <td>
                  <span className="badge">{x.active ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="p-4 text-right">
                  <button
                    title="Editar"
                    className="p-2"
                    onClick={() => {
                      const name = prompt('Nuevo nombre', x.name);
                      if (name) api(`${path}/${x.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }).then(load);
                    }}
                  >
                    <Pencil size={17} />
                  </button>
                  {!readOnly && (
                    <button
                      title="Desactivar"
                      className="p-2 text-red-600"
                      onClick={() => api(`${path}/${x.id}`, { method: 'DELETE' }).then(load)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
