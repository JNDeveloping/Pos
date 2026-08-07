import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { api, type Me } from './lib/api';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Products } from './pages/Products';
import { SimpleCrud } from './pages/SimpleCrud';
import { Users } from './pages/Users';
const pages: Record<string, React.ReactNode> = {
  '/': <Dashboard />,
  '/branches': <SimpleCrud title="Sucursales" path="/branches" withCode />,
  '/categories': <SimpleCrud title="Categorías" path="/categories" />,
  '/brands': <SimpleCrud title="Marcas" path="/brands" />,
  '/users': <Users />,
  '/products': <Products />,
  '/roles': <SimpleCrud title="Roles y permisos" path="/roles" readOnly />,
  '/settings': (
    <div>
      <h1 className="text-3xl font-bold">Configuración</h1>
      <p className="mt-2 text-slate-500">Los datos de empresa se administran desde esta sección.</p>
    </div>
  ),
};
export default function App() {
  const [me, setMe] = useState<Me>();
  const token = localStorage.getItem('accessToken');
  useEffect(() => {
    if (token) api<Me>('/auth/me').then(setMe);
  }, [token]);
  if (!token || location.pathname === '/login') return <Login />;
  if (!me) return <div className="grid min-h-screen place-items-center text-brand-700">Cargando administración…</div>;
  return <Layout me={me}>{pages[location.pathname] ?? pages['/']}</Layout>;
}
