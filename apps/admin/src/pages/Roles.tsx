import { FormEvent, useEffect, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { appPath } from '../lib/navigation';
export type RoleView = {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  systemRole: boolean;
  permissions: { permission: { id: string } }[];
  _count: { users: number };
};
export function Roles() {
  const [roles, setRoles] = useState<RoleView[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const load = () =>
    api<RoleView[]>('/roles')
      .then(setRoles)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api('/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: f.get('name'),
          code: String(f.get('code')).toUpperCase().replace(/\s+/g, '_'),
          description: f.get('description') || undefined,
        }),
      });
      setOpen(false);
      await load();
    } catch (x) {
      setError(String(x));
    }
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-brand-600">SEGURIDAD</p>
          <h1 className="text-3xl font-bold">Roles y permisos</h1>
          <p className="text-slate-500">Controle granularmente módulos, acciones y accesos.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(!open)}>
          <Plus size={18} />
          Nuevo rol
        </button>
      </header>
      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {open && (
        <form onSubmit={create} className="card grid gap-3 p-5 md:grid-cols-3">
          <input name="name" required placeholder="Nombre (ej. Comprador)" />
          <input name="code" required pattern="[A-Za-z][A-Za-z0-9_ ]+" placeholder="Código (COMPRADOR)" />
          <input name="description" placeholder="Descripción opcional" />
          <button className="btn-primary md:col-span-3">Crear rol</button>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Código</th>
              <th>Usuarios</th>
              <th>Permisos</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="font-semibold">{role.name}</td>
                <td>
                  <code>{role.code}</code>
                </td>
                <td>{role._count.users}</td>
                <td>{role.code === 'SUPER_ADMIN' ? 'Todos' : role.permissions.length}</td>
                <td>
                  {role.systemRole ? <span className="badge bg-brand-50 text-brand-700">Sistema</span> : 'Personalizado'}
                </td>
                <td>{role.active ? 'Activo' : 'Inactivo'}</td>
                <td>
                  <a className="btn-secondary" href={appPath(`/admin/roles/${role.id}`)}>
                    <ShieldCheck size={16} />
                    Administrar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
