import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { PwaManager } from './components/PwaManager';
import { api, hasPermission, type Me } from './lib/api';
import { currentRoute } from './lib/navigation';
import { connectivityService } from './services/connectivity.service';
import { branchContext } from './lib/branch-context';
import { Dashboard } from './pages/Dashboard';
import { Branches, type Branch } from './pages/Branches';
import { Diagnostics } from './pages/Diagnostics';
import { Login } from './pages/Login';
import { Products } from './pages/Products';
import { SimpleCrud } from './pages/SimpleCrud';
import { Users } from './pages/Users';
import { Commerce } from './pages/Commerce';
import { PriceLists } from './pages/PriceLists';
import { Labels } from './pages/Labels';
import { Audit } from './pages/Audit';
import { ProductDetail } from './pages/ProductDetail';
import { BranchDetail } from './pages/BranchDetail';
import { Suppliers } from './pages/Suppliers';
import { Purchases } from './pages/Purchases';
import { InvoiceImport } from './pages/InvoiceImport';
import { SupplierDetail } from './pages/SupplierDetail';
import { requestTabSession } from './lib/auth-session';
import { Roles } from './pages/Roles';
import { RoleDetail } from './pages/RoleDetail';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { PurchaseOrderNew } from './pages/PurchaseOrderNew';
import { PurchaseOrderDetail } from './pages/PurchaseOrderDetail';
import { PurchaseDetail } from './pages/PurchaseDetail';
import { PurchaseNew } from './pages/PurchaseNew';
const pages: Record<string, React.ReactNode> = {
  '/': <Dashboard />,
  '/branches': <Branches />,
  '/categories': <SimpleCrud title="Categorías" path="/categories" />,
  '/brands': <SimpleCrud title="Marcas" path="/brands" />,
  '/users': <Users />,
  '/products': <Products />,
  '/catalog': <Products mode="master" />,
  '/roles': <Roles />,
  '/settings': <Diagnostics />,
  '/admin/diagnostics': <Diagnostics />,
  '/prices': <Commerce kind="prices" />,
  '/costs': <Commerce kind="costs" />,
  '/price-lists': <PriceLists />,
  '/labels': <Labels />,
  '/audit': <Audit />,
  '/suppliers': <Suppliers />,
  '/purchases': <Purchases />,
  '/purchases/invoices': <InvoiceImport />,
  '/admin/suppliers': <Suppliers />,
  '/admin/purchase-orders': <PurchaseOrders />,
  '/admin/purchase-orders/new': <PurchaseOrderNew />,
  '/admin/purchases': <Purchases />,
  '/admin/purchases/new': <PurchaseNew />,
  '/admin/invoices': <InvoiceImport />,
  '/admin/invoices/analyze': <InvoiceImport />,
  '/admin/roles': <Roles />,
  '/admin/products': <Products />,
  '/admin/catalog': <Products mode="master" />,
  '/admin/prices': <Commerce kind="prices" />,
  '/admin/costs': <Commerce kind="costs" />,
  '/admin/labels': <Labels />,
  '/admin/audit': <Audit />,
};
const routePermissions: Record<string, string> = {
  '/suppliers': 'suppliers.view',
  '/admin/suppliers': 'suppliers.view',
  '/purchases': 'purchases.view',
  '/admin/purchases': 'purchases.view',
  '/admin/purchases/new': 'purchases.create',
  '/purchases/invoices': 'invoices.view',
  '/admin/invoices': 'invoices.view',
  '/admin/invoices/analyze': 'invoices.analyze',
  '/admin/purchase-orders': 'purchaseOrders.view',
  '/admin/purchase-orders/new': 'purchaseOrders.create',
  '/roles': 'roles.view',
  '/admin/roles': 'roles.view',
};
export default function App() {
  const route = currentRoute();
  const [me, setMe] = useState<Me>(),
    [ready, setReady] = useState(false),
    [branches, setBranches] = useState<Branch[]>([]),
    [currentBranchId, setCurrentBranchId] = useState<string>();
  useEffect(() => {
    connectivityService.start();
    return () => connectivityService.stop();
  }, []);
  useEffect(() => {
    async function restore() {
      const token = sessionStorage.getItem('accessToken') ?? (await requestTabSession())?.accessToken;
      if (token) {
        try {
          const online = await api<Me>('/auth/me');
          setMe(online);
        } catch (error) {
          if (error instanceof Error && error.message.includes('sesión expiró')) sessionStorage.clear();
        }
      }
      setReady(true);
    }
    void restore();
  }, []);
  useEffect(() => {
    if (!me) return;
    async function configureBranch() {
      const apply = (available: Branch[]) => {
        setBranches(available);
        const selected = available.find((branch) => branch.id === branchContext.get())?.id;
        const nextBranchId = available.length === 1 ? available[0].id : selected;
        setCurrentBranchId(nextBranchId);
        branchContext.set(nextBranchId);
      };
      try {
        apply((await api<Branch[]>('/branches')).filter((branch) => branch.active));
      } catch {
        // The global connection indicator explains the temporary API outage.
      }
    }
    void configureBranch();
  }, [me]);
  if (!ready)
    return <div className="grid min-h-screen place-items-center text-brand-700">Preparando este dispositivo…</div>;
  if (!me || route === '/login')
    return (
      <>
        <Login />
        <PwaManager />
      </>
    );
  const productMatch = route.match(/^\/(?:admin\/)?products\/([0-9a-f-]{36})$/i);
  const supplierMatch = route.match(/^\/(?:admin\/)?suppliers\/([0-9a-f-]{36})$/i);
  const branchMatch = route.match(/^\/(?:admin\/)?branches\/([0-9a-f-]{36})$/i);
  const roleMatch = route.match(/^\/(?:admin\/)?roles\/([0-9a-f-]{36})$/i);
  const orderMatch = route.match(/^\/admin\/purchase-orders\/([0-9a-f-]{36})$/i);
  const purchaseMatch = route.match(/^\/admin\/purchases\/([0-9a-f-]{36})$/i);
  const requiredPermission =
    routePermissions[route] ??
    (supplierMatch
      ? 'suppliers.view'
      : roleMatch
        ? 'roles.view'
        : orderMatch
          ? 'purchaseOrders.view'
          : purchaseMatch
            ? 'purchases.view'
            : undefined);
  if (requiredPermission && !hasPermission(me, requiredPermission))
    return (
      <Layout me={me} branches={branches} currentBranchId={currentBranchId} onBranchChange={async () => {}}>
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Acceso denegado</h1>
          <p className="mt-2 text-slate-500">
            No tiene el permiso <code>{requiredPermission}</code> para abrir esta sección.
          </p>
        </div>
      </Layout>
    );
  const page = productMatch ? (
    <ProductDetail id={productMatch[1]} />
  ) : supplierMatch ? (
    <SupplierDetail id={supplierMatch[1]} />
  ) : branchMatch ? (
    <BranchDetail id={branchMatch[1]} />
  ) : roleMatch ? (
    <RoleDetail id={roleMatch[1]} />
  ) : orderMatch ? (
    <PurchaseOrderDetail id={orderMatch[1]} />
  ) : purchaseMatch ? (
    <PurchaseDetail id={purchaseMatch[1]} />
  ) : route === '/settings' && !me.permissions.includes('branches.settings') ? (
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
          branchContext.set(branchId);
          setCurrentBranchId(branchId);
        }}
      >
        {page}
      </Layout>
      <PwaManager />
    </>
  );
}
