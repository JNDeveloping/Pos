import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { PwaManager } from './components/PwaManager';
import { api, type Me } from './lib/api';
import { currentRoute } from './lib/navigation';
import { connectivityService } from './offline/connectivity/connectivity.service';
import { offlineDb } from './offline/db/database';
import { deviceConfig, saveDeviceConfig } from './offline/db/device';
import { cacheSession, offlineSession } from './offline/session/offline-session';
import { syncService } from './offline/sync/sync.service';
import { Dashboard } from './pages/Dashboard';
import { Branches, type Branch } from './pages/Branches';
import { Diagnostics } from './pages/Diagnostics';
import { Login } from './pages/Login';
import { Products } from './pages/Products';
import { SimpleCrud } from './pages/SimpleCrud';
import { Users } from './pages/Users';
const pages: Record<string, React.ReactNode> = {
  '/': <Dashboard />,
  '/branches': <Branches />,
  '/categories': <SimpleCrud title="Categorías" path="/categories" />,
  '/brands': <SimpleCrud title="Marcas" path="/brands" />,
  '/users': <Users />,
  '/products': <Products />,
  '/catalog': <Products mode="master" />,
  '/roles': <SimpleCrud title="Roles y permisos" path="/roles" readOnly />,
  '/settings': <Diagnostics />,
};
export default function App() {
  const route = currentRoute();
  const [me, setMe] = useState<Me>(),
    [ready, setReady] = useState(false),
    [branches, setBranches] = useState<Branch[]>([]),
    [currentBranchId, setCurrentBranchId] = useState<string>();
  const token = sessionStorage.getItem('accessToken');
  useEffect(() => {
    connectivityService.start();
    void syncService.initialize();
    return () => connectivityService.stop();
  }, []);
  useEffect(() => {
    async function restore() {
      const cached = await offlineSession();
      if (cached) {
        setMe(cached);
        setReady(true);
      }
      if (token) {
        try {
          const online = await api<Me>('/auth/me');
          await cacheSession(online);
          setMe(online);
          void syncService.sync();
          setReady(true);
          return;
        } catch {
          /* The server may be unavailable; fall through to the limited cached session. */
        }
      }
      if (!cached) setReady(true);
    }
    void restore();
  }, [token]);
  useEffect(() => {
    if (!me) return;
    async function configureBranch() {
      const apply = async (available: Branch[]) => {
        setBranches(available);
        const device = await deviceConfig();
        const selected = available.find((branch) => branch.id === device.branchId)?.id;
        const nextBranchId = available.length === 1 ? available[0].id : selected;
        setCurrentBranchId(nextBranchId);
        if (nextBranchId !== device.branchId) {
          await saveDeviceConfig({ ...device, branchId: nextBranchId });
          if (connectivityService.current === 'ONLINE') void syncService.rebuild();
        }
      };
      const local = (await offlineDb.branches.toArray()).filter((branch) => branch.active) as Branch[];
      if (local.length) await apply(local);
      try {
        await apply((await api<Branch[]>('/branches')).filter((branch) => branch.active));
      } catch {
        // The local branch context was already applied; a network error must not block startup.
      }
    }
    void configureBranch();
  }, [me]);
  if (!ready)
    return <div className="grid min-h-screen place-items-center text-brand-700">Preparando este dispositivo…</div>;
  if (!me || route === '/login')
    return (
      <>
        <Login offlineAvailable={Boolean(me)} />
        <PwaManager />
      </>
    );
  const page =
    route === '/settings' && !me.permissions.includes('branches.update') ? (
      <div className="card p-6">No tenés permiso para configurar este dispositivo.</div>
    ) : (
      (pages[route] ?? pages['/'])
    );
  return (
    <>
      <Layout
        me={me}
        branches={branches}
        currentBranchId={currentBranchId}
        onBranchChange={async (branchId) => {
          const device = await deviceConfig();
          await saveDeviceConfig({ ...device, branchId });
          setCurrentBranchId(branchId);
          if (connectivityService.current === 'ONLINE') await syncService.rebuild();
        }}
      >
        {page}
      </Layout>
      <PwaManager />
    </>
  );
}
