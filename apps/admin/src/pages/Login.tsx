import { FormEvent, useState } from 'react';
import { Boxes, LockKeyhole } from 'lucide-react';
import { api } from '../lib/api';
export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: f.get('identifier'), password: f.get('password') }),
      });
      localStorage.setItem('accessToken', r.accessToken);
      localStorage.setItem('refreshToken', r.refreshToken);
      location.href = '/';
    } catch (x) {
      setError((x as Error).message);
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-brand-50 p-5">
      <section className="card w-full max-w-md p-9">
        <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
          <Boxes />
        </span>
        <p className="text-xs font-bold tracking-widest text-brand-600">ADMINISTRACIÓN CENTRAL</p>
        <h1 className="mt-2 text-3xl font-bold">El Rincón de los Nietos</h1>
        <p className="mt-2 text-slate-500">Ingresá con tu usuario o correo electrónico.</p>
        <form className="mt-7 grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-semibold">
            Usuario o email
            <input name="identifier" required autoFocus />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Contraseña
            <input name="password" type="password" required minLength={8} />
          </label>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn mt-2" disabled={loading}>
            <LockKeyhole size={18} />
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
