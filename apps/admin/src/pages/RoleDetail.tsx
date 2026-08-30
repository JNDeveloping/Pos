import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LockKeyhole, Save, Users } from 'lucide-react';
import { api } from '../lib/api';
import type { RoleView } from './Roles';
type Permission = { id: string; code: string; module: string; label: string; description: string; sortOrder: number };
type Detail = RoleView & {
  description?: string;
  users: { user: { id: string; username: string; firstName: string; lastName: string; active: boolean } }[];
};
const moduleLabels: Record<string, string> = {
  DASHBOARD: 'Panel',
  PRODUCTS: 'Productos y catálogo',
  PRICES: 'Precios y costos',
  SUPPLIERS: 'Proveedores',
  PURCHASE_ORDERS: 'Órdenes de compra',
  PURCHASES: 'Compras',
  INVOICES: 'Facturas e IA',
  BRANCHES: 'Sucursales',
  USERS: 'Usuarios',
  ROLES: 'Roles',
  OPERATIONS: 'Operación',
};
export function RoleDetail({ id }: { id: string }) {
  const [role, setRole] = useState<Detail>(),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [tab, setTab] = useState('PERMISOS'),
    [message, setMessage] = useState(''),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([api<Detail>(`/roles/${id}`), api<Permission[]>('/permissions')])
      .then(([r, p]) => {
        setRole(r);
        setPermissions(p);
        setSelected(new Set(r.code === 'SUPER_ADMIN' ? p.map((x) => x.id) : r.permissions.map((x) => x.permission.id)));
      })
      .catch((e) => setMessage(String(e)));
  }, [id]);
  const grouped = useMemo(
    () =>
      Object.entries(
        permissions.reduce((result: Record<string, Permission[]>, permission) => {
          const rows = result[permission.module] ?? [];
          rows.push(permission);
          result[permission.module] = rows;
          return result;
        }, {}),
      ),
    [permissions],
  );
  if (!role) return <div className="card p-6">{message || 'Cargando rol…'}</div>;
  const locked = role.code === 'SUPER_ADMIN';
  function toggle(ids: string[], checked: boolean) {
    if (locked) return;
    setSelected((old) => {
      const next = new Set(old);
      ids.forEach((x) => (checked ? next.add(x) : next.delete(x)));
      return next;
    });
  }
  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await api(`/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissionIds: [...selected] }) });
      setMessage('Permisos guardados. Las sesiones activas los reciben en la próxima petición.');
    } catch (e) {
      setMessage(String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-5">
      <header>
        <a href="../roles" className="text-sm text-brand-600">
          ← Roles
        </a>
        <div className="mt-2 flex items-center gap-3">
          <span className="metric-icon">
            <LockKeyhole />
          </span>
          <div>
            <h1 className="text-3xl font-bold">{role.name}</h1>
            <p className="text-slate-500">
              {role.code} · {role.systemRole ? 'Rol del sistema' : 'Rol personalizado'}
            </p>
          </div>
        </div>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {['GENERAL', 'PERMISOS', 'USUARIOS', 'AUDITORÍA'].map((x) => (
          <button className={tab === x ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab(x)} key={x}>
            {x}
          </button>
        ))}
      </div>
      {message && <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-700">{message}</div>}
      {tab === 'PERMISOS' && (
        <>
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <b className="mr-auto">
              {selected.size} de {permissions.length} permisos
            </b>
            {locked ? (
              <span className="badge bg-amber-50 text-amber-700">
                <LockKeyhole size={14} />
                SUPER_ADMIN siempre tiene acceso total
              </span>
            ) : (
              <>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    toggle(
                      permissions.map((x) => x.id),
                      true,
                    )
                  }
                >
                  Seleccionar todos
                </button>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    toggle(
                      permissions.map((x) => x.id),
                      false,
                    )
                  }
                >
                  Quitar todos
                </button>
                <button className="btn-primary" disabled={saving} onClick={() => void save()}>
                  <Save size={16} />
                  {saving ? 'Guardando…' : 'Guardar permisos'}
                </button>
              </>
            )}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {grouped.map(([module, list]) => {
              const rows = list ?? [],
                all = rows.every((x) => selected.has(x.id));
              return (
                <section className="card overflow-hidden" key={module}>
                  <header className="flex items-center justify-between border-b bg-slate-50 p-4">
                    <div>
                      <b>{moduleLabels[module] ?? module}</b>
                      <small className="ml-2 text-slate-400">
                        {rows.filter((x) => selected.has(x.id)).length}/{rows.length}
                      </small>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={all}
                        disabled={locked}
                        onChange={(e) =>
                          toggle(
                            rows.map((x) => x.id),
                            e.target.checked,
                          )
                        }
                      />
                      Módulo completo
                    </label>
                  </header>
                  <div className="divide-y">
                    {rows.map((p) => (
                      <label className="flex cursor-pointer gap-3 p-4 hover:bg-slate-50" key={p.id}>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          disabled={locked}
                          onChange={(e) => toggle([p.id], e.target.checked)}
                        />
                        <span>
                          <b className="block text-sm">{p.label || p.code}</b>
                          <small className="text-slate-500">{p.code}</small>
                        </span>
                        {selected.has(p.id) && <CheckCircle2 className="ml-auto text-emerald-500" size={17} />}
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      {tab === 'USUARIOS' && (
        <div className="card divide-y">
          {role.users.length ? (
            role.users.map(({ user }) => (
              <div className="flex items-center gap-3 p-4" key={user.id}>
                <span className="avatar">
                  <Users size={16} />
                </span>
                <span>
                  <b>
                    {user.firstName} {user.lastName}
                  </b>
                  <small className="block text-slate-500">{user.username}</small>
                </span>
                <span className="badge ml-auto">{user.active ? 'Activo' : 'Inactivo'}</span>
              </div>
            ))
          ) : (
            <p className="p-8 text-center text-slate-500">Este rol todavía no tiene usuarios.</p>
          )}
        </div>
      )}
      {tab === 'GENERAL' && (
        <div className="card grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <small>Nombre</small>
            <p className="font-semibold">{role.name}</p>
          </div>
          <div>
            <small>Código</small>
            <p className="font-semibold">{role.code}</p>
          </div>
          <div className="sm:col-span-2">
            <small>Descripción</small>
            <p>{role.description || 'Sin descripción'}</p>
          </div>
        </div>
      )}
      {tab === 'AUDITORÍA' && (
        <div className="card p-8 text-center text-slate-500">
          Los cambios se registran como ROLE_CREATED, ROLE_UPDATED y ROLE_PERMISSIONS_UPDATED en Auditoría.
        </div>
      )}
    </div>
  );
}
