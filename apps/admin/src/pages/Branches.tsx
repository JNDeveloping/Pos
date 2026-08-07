import { FormEvent, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

export type Branch = {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  active: boolean;
};

const emptyForm = { name: '', code: '', address: '', city: '', province: '', phone: '', copyFromBranchId: '' };

export function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Branch>();
  const [error, setError] = useState('');
  const load = () => api<Branch[]>('/branches').then(setBranches);

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const branch = await api<Branch>('/branches', {
        method: 'POST',
        body: JSON.stringify({ ...form, copyFromBranchId: form.copyFromBranchId || undefined }),
      });
      setCreated(branch);
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la sucursal');
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sucursales</h1>
          <p className="mt-2 text-slate-500">
            La operación piloto usa una sucursal y puede crecer sin cambios técnicos.
          </p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>
          <Plus size={18} /> Nueva sucursal
        </button>
      </div>

      {created && (
        <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">
          <b>{created.name}</b> fue creada correctamente. Ya puede configurarse y vincularse a dispositivos.
        </p>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => (
          <article className="card p-5" key={branch.id}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Building2 />
              </span>
              <span className="badge">{branch.active ? 'Activa' : 'Inactiva'}</span>
            </div>
            <h2 className="mt-4 text-lg font-bold">{branch.name}</h2>
            <p className="text-sm text-slate-500">{branch.code}</p>
            <p className="mt-3 min-h-10 text-sm">
              {[branch.address, branch.city, branch.province].filter(Boolean).join(', ') || 'Sin dirección'}
            </p>
            <div className="mt-4 flex justify-end gap-2 border-t pt-3">
              <button
                className="p-3"
                title="Editar"
                onClick={() => {
                  const name = prompt('Nombre de la sucursal', branch.name);
                  if (name)
                    void api(`/branches/${branch.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }).then(load);
                }}
              >
                <Pencil size={18} />
              </button>
              <button
                className="p-3 text-red-600"
                title="Desactivar"
                onClick={() =>
                  confirm(`¿Desactivar ${branch.name}?`) &&
                  void api(`/branches/${branch.id}`, { method: 'DELETE' }).then(load)
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
          <form className="card w-full max-w-2xl p-6" onSubmit={create}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Nueva sucursal</h2>
                <p className="text-sm text-slate-500">El stock físico comenzará en cero.</p>
              </div>
              <button type="button" className="p-3" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(['name', 'code', 'address', 'city', 'province', 'phone'] as const).map((field) => (
                <label className="grid gap-2 text-sm font-semibold" key={field}>
                  {
                    {
                      name: 'Nombre',
                      code: 'Código',
                      address: 'Dirección',
                      city: 'Localidad',
                      province: 'Provincia',
                      phone: 'Teléfono',
                    }[field]
                  }
                  <input
                    required={field === 'name' || field === 'code'}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {branches.length > 0 && (
              <label className="mt-5 grid gap-2 rounded-xl bg-brand-50 p-4 text-sm font-semibold">
                ¿Querés copiar la configuración desde una sucursal existente?
                <select
                  value={form.copyFromBranchId}
                  onChange={(e) => setForm({ ...form, copyFromBranchId: e.target.value })}
                >
                  <option value="">No copiar configuración</option>
                  {branches
                    .filter((x) => x.active)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
                <small className="font-normal text-slate-600">
                  Copia productos habilitados, costos, precios, márgenes y mínimos. Nunca copia stock físico.
                </small>
              </label>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="btn">Crear sucursal</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
