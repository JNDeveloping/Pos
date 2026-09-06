import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, hasPermission, type Me } from '../lib/api';
type Role = { id: string; name: string; code: string; permissions?: { permission: { code: string } }[] };
type Branch = { id: string; name: string; code: string; active?: boolean };
type User = {
  id: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  active: boolean;
  branch?: { name: string };
  branchAccesses: { branch: Branch }[];
  roles: { role: Role }[];
};
export function Users() {
  const [users, setUsers] = useState<User[]>([]),
    [roles, setRoles] = useState<Role[]>([]),
    [branches, setBranches] = useState<Branch[]>([]),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<User>(),
    [me, setMe] = useState<Me>(),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const load = () =>
    Promise.all([api<User[]>('/users'), api<Role[]>('/roles'), api<Branch[]>('/branches'), api<Me>('/auth/me')])
      .then(([u, r, b, current]) => {
        setUsers(u);
        setRoles(r);
        setBranches(b.filter((branch) => branch.active !== false));
        setMe(current);
      })
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      setSaving(true); setError('');
      await api('/users', { method: 'POST', body: JSON.stringify({
        username: f.get('username'),
        email: f.get('email') || undefined,
        password: f.get('password'),
        firstName: f.get('firstName'),
        lastName: f.get('lastName'),
        roleIds: f.getAll('roleIds'),
        branchIds: f.getAll('branchIds'),
      }) });
      setOpen(false); await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }
  async function saveAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    try {
      setSaving(true); setError('');
      await api(`/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify({
        username: f.get('username'),
        email: f.get('email') || undefined,
        firstName: f.get('firstName'),
        lastName: f.get('lastName'),
        active: f.get('active') === 'on',
        password: f.get('password') || undefined,
        roleIds: f.getAll('roleIds'),
        branchIds: f.getAll('branchIds'),
      }) });
      setEditing(undefined);
      await load();
    } catch (x) {
      setError(String(x));
    } finally { setSaving(false); }
  }
  async function remove(user: User) {
    if (!confirm(`¿Desactivar y eliminar el acceso de ${user.firstName} ${user.lastName}? Sus ventas y auditoría se conservarán.`)) return;
    try { setError(''); await api(`/users/${user.id}`, { method: 'DELETE' }); setEditing(undefined); await load(); }
    catch (cause) { setError((cause as Error).message); }
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="text-slate-500">Roles múltiples, permisos efectivos y alcance por sucursal.</p>
        </div>
        {hasPermission(me, 'users.create') && <button className="btn-primary" onClick={() => setOpen(!open)}>
          <Plus />
          Nuevo usuario
        </button>}
      </header>
      <nav className="flex gap-2 border-b">
        <a className="product-subtab active" href="/pos/users">
          Usuarios
        </a>
        <a className="product-subtab" href="/pos/roles">
          Roles y permisos
        </a>
      </nav>
      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {open && (
        <form className="card grid gap-3 p-5 md:grid-cols-2" onSubmit={create}>
          <input name="firstName" placeholder="Nombre" required />
          <input name="lastName" placeholder="Apellido" required />
          <input name="username" placeholder="Usuario" required />
          <input name="email" type="email" placeholder="Email opcional" />
          <input name="password" type="password" minLength={8} placeholder="Contraseña temporal" required />
          <fieldset className="rounded-xl border p-3">
            <legend className="px-2 text-sm font-semibold">Roles</legend>
            <div className="grid gap-2">
              {roles.map((r) => (
                <label className="flex items-center gap-2 text-sm" key={r.id}>
                  <input type="checkbox" name="roleIds" value={r.id} />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border p-3">
            <legend className="px-2 text-sm font-semibold">Sucursales habilitadas</legend>
            <div className="grid gap-2">{branches.map((branch) => <label className="flex items-center gap-2 text-sm" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id}/>{branch.name}</label>)}</div>
          </fieldset>
          <button className="btn-primary md:col-span-2" disabled={saving}>{saving ? 'Creando…' : 'Crear usuario'}</button>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Roles</th>
              <th>Permisos efectivos</th>
              <th>Sucursal</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const effective = new Set(
                u.roles.flatMap(({ role }) => role.permissions?.map((x) => x.permission.code) ?? []),
              );
              return (
                <tr key={u.id}>
                  <td className="font-semibold">
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.username}</td>
                  <td>{u.roles.map((r) => r.role.name).join(', ') || 'Sin rol'}</td>
                  <td>
                    <span title={[...effective].join('\n')} className="badge bg-brand-50 text-brand-700">
                      {u.roles.some((x) => x.role.code === 'SUPER_ADMIN') ? 'Todos' : effective.size}
                    </span>
                  </td>
                  <td>{u.branchAccesses.map(({ branch }) => branch.name).join(', ') || u.branch?.name || 'Sin acceso'}</td>
                  <td>
                    <span className="badge">{u.active ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td>
                    {hasPermission(me, 'users.update') && <button className="btn-secondary" onClick={() => setEditing(u)}>
                      <Pencil size={15} />
                      Editar
                    </button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form className="card w-full max-w-2xl p-5" onSubmit={saveAccess}>
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Roles de {editing.firstName}</h2>
                <p className="text-sm text-slate-500">Los permisos efectivos son la unión de los roles.</p>
              </div>
              <button type="button" onClick={() => setEditing(undefined)}>
                <X />
              </button>
            </div>
            <section className="my-5 grid gap-3 sm:grid-cols-2"><label>Nombre<input name="firstName" defaultValue={editing.firstName} required/></label><label>Apellido<input name="lastName" defaultValue={editing.lastName} required/></label><label>Nombre de usuario<input name="username" defaultValue={editing.username} minLength={3} required/></label><label>Email<input name="email" type="email" defaultValue={editing.email}/></label><label className="sm:col-span-2">Nueva contraseña<input name="password" type="password" minLength={8} placeholder="Dejar vacío para conservar"/></label><label className="check-field sm:col-span-2"><input name="active" type="checkbox" defaultChecked={editing.active}/>Usuario habilitado</label></section>
            <div className="my-5 grid gap-3 sm:grid-cols-2">
              {roles.map((r) => (
                <label className="flex items-center gap-2 rounded-lg border p-3" key={r.id}>
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={r.id}
                    defaultChecked={editing.roles.some((x) => x.role.id === r.id)}
                  />
                  <span>
                    <b className="block text-sm">{r.name}</b>
                    <small>{r.code}</small>
                  </span>
                </label>
              ))}
            </div>
            <fieldset className="mb-5 rounded-xl border p-4"><legend className="px-2 font-bold">Sucursales donde puede operar</legend><div className="grid gap-2 sm:grid-cols-2">{branches.map((branch) => <label className="flex items-center gap-2 rounded-lg border p-3" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked={editing.branchAccesses.some((access) => access.branch.id === branch.id) || editing.branch?.name === branch.name}/>{branch.name}</label>)}</div></fieldset>
            <div className="flex flex-wrap gap-3">{hasPermission(me, 'users.delete') && me?.user.id !== editing.id && <button type="button" className="btn-secondary mr-auto text-red-700" onClick={() => void remove(editing)}><Trash2/>Eliminar usuario</button>}<button type="button" className="btn-secondary" onClick={() => setEditing(undefined)}>Cancelar</button><button className="btn-primary" disabled={saving}><KeyRound/>{saving ? 'Guardando…' : 'Guardar usuario'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
