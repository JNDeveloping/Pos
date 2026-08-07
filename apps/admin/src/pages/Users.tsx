import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
type Role = { id: string; name: string; code: string };
type User = {
  id: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  active: boolean;
  branch?: { name: string };
  roles: { role: Role }[];
};
export function Users() {
  const [users, setUsers] = useState<User[]>([]),
    [roles, setRoles] = useState<Role[]>([]),
    [open, setOpen] = useState(false);
  const load = () => api<User[]>('/users').then(setUsers);
  useEffect(() => {
    load();
    api<Role[]>('/roles').then(setRoles);
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: f.get('username'),
        email: f.get('email') || undefined,
        password: f.get('password'),
        firstName: f.get('firstName'),
        lastName: f.get('lastName'),
        roleIds: [f.get('roleId')],
      }),
    });
    setOpen(false);
    load();
  }
  return (
    <>
      <div className="flex justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="mt-2 text-slate-500">Accesos, roles y alcance por sucursal.</p>
        </div>
        <button className="btn" onClick={() => setOpen(!open)}>
          <Plus />
          Nuevo usuario
        </button>
      </div>
      {open && (
        <form className="card mt-6 grid gap-3 p-5 md:grid-cols-2" onSubmit={create}>
          <input name="firstName" placeholder="Nombre" required />
          <input name="lastName" placeholder="Apellido" required />
          <input name="username" placeholder="Usuario" required />
          <input name="email" type="email" placeholder="Email opcional" />
          <input name="password" type="password" minLength={8} placeholder="Contraseña temporal" required />
          <select name="roleId" required>
            <option value="">Seleccionar rol</option>
            {roles.map((r) => (
              <option value={r.id}>{r.name}</option>
            ))}
          </select>
          <button className="btn md:col-span-2">Crear usuario</button>
        </form>
      )}
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-4">Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Sucursal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr className="border-b" key={u.id}>
                <td className="p-4 font-semibold">
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.username}</td>
                <td>{u.roles.map((r) => r.role.name).join(', ')}</td>
                <td>{u.branch?.name ?? 'Todas'}</td>
                <td>
                  <span className="badge">{u.active ? 'Activo' : 'Inactivo'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
