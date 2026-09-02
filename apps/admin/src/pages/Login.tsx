import { FormEvent, useState } from 'react';
import { Boxes, LockKeyhole } from 'lucide-react';
import { api } from '../lib/api';
import { navigate } from '../lib/navigation';
import { storeTokens } from '../lib/auth-session';
import { FullscreenButton } from '../components/FullscreenButton';
export const loginDestination = (user: { roles: string[]; permissions: string[] }) =>
  user.roles.includes('SUPER_ADMIN') || user.permissions.includes('panels.admin') ? '/owner' : '/';
export function Login() {
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ accessToken: string; refreshToken: string; user: { roles: string[]; permissions: string[] } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: f.get('identifier'), password: f.get('password') }),
      });
      storeTokens(r);
      navigate(loginDestination(r.user));
    } catch (x) {
      setError(
        navigator.onLine ? (x as Error).message : 'Necesitás Internet para el primer ingreso en este dispositivo.',
      );
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-brand-50 p-5">
      <FullscreenButton className="login-fullscreen"/>
      <section className="card w-full max-w-md p-7 sm:p-9">
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
          <button className="btn mt-2 min-h-12" disabled={loading}>
            <LockKeyhole size={18} />
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-400">
          El sistema requiere conexión con el servidor para operar.
        </p>
      </section>
    </main>
  );
}
