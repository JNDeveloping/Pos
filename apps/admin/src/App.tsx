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
import { Settings } from './pages/Settings';
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
import { Stock } from './pages/Stock';
import { StockOperations } from './pages/StockOperations';
import { Pos } from './pages/Pos';
import { SalesAdmin } from './pages/SalesAdmin';
import { SaleDetail } from './pages/SaleDetail';
import { PosSettingsPage } from './pages/PosSettings';
import { CashierLayout } from './components/CashierLayout';
import { CashierHome } from './pages/CashierHome';
const pages: Record<string, React.ReactNode> = {
  '/admin': <Dashboard />,
  '/branches': <Branches />,
  '/categories': <SimpleCrud title="Categorías" path="/categories" />,
  '/brands': <SimpleCrud title="Marcas" path="/brands" />,
  '/users': <Users />,
  '/products': <Products />,
  '/catalog': <Products mode="master" />,
  '/roles': <Roles />,
  '/settings': <Settings />,
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
  '/admin/stock': <Stock />,
  '/admin/stock/movements': <StockOperations kind="movements" />,
  '/admin/inventory': <StockOperations kind="inventory" />,
  '/admin/waste': <StockOperations kind="waste" />,
  '/admin/expirations': <StockOperations kind="expirations" />,
  '/admin/transfers': <StockOperations kind="transfers" />,
  '/admin/sales': <SalesAdmin kind="sales" />,
  '/admin/payment-methods': <SalesAdmin kind="payment-methods" />,
  '/admin/terminals': <SalesAdmin kind="terminals" />,
  '/admin/pos-settings': <PosSettingsPage />,
};
const routePermissions: Record<string, string> = {
  '/admin': 'dashboard.view',
  '/products': 'products.view',
  '/admin/products': 'products.view',
  '/catalog': 'products.view',
  '/admin/catalog': 'products.view',
  '/labels': 'labels.view',
  '/admin/labels': 'labels.view',
  '/branches': 'branches.view',
  '/users': 'users.view',
  '/audit': 'audit.view',
  '/admin/audit': 'audit.view',
  '/settings': 'branches.settings',
  '/categories': 'categories.view',
  '/brands': 'brands.view',
  '/cashier/products': 'products.view',
  '/cashier/stock': 'stock.view',
  '/cashier/sales': 'sales.view',
  '/cashier/labels': 'labels.view',
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
  '/admin/stock': 'stock.view',
  '/admin/stock/movements': 'stock.movements',
  '/admin/inventory': 'inventory.view',
  '/admin/waste': 'waste.view',
  '/admin/expirations': 'expirations.view',
  '/admin/transfers': 'transfers.view',
  '/admin/sales': 'sales.view',
  '/admin/payment-methods': 'paymentMethods.view',
  '/admin/terminals': 'terminals.view',
  '/admin/pos-settings': 'terminals.manage',
};
export default function App() {
  const rawRoute = currentRoute();
  const redirects: Record<string, string> = {
    '/admin/prices': '/products?tab=pricing',
    '/admin/costs': '/products?tab=pricing',
    '/admin/roles': '/users?tab=roles',
    '/admin/inventory': '/admin/stock',
    '/admin/stock/movements': '/admin/stock',
    '/admin/transfers': '/admin/stock',
    '/admin/purchase-orders': '/admin/purchases',
  };
  if (redirects[rawRoute]) {
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL.replace(/\/$/, '')}${redirects[rawRoute]}`);
  }
  const route = redirects[rawRoute]?.split('?')[0] ?? rawRoute;
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
        const endpoint = hasPermission(me, 'branches.view') ? '/branches' : '/cash-sessions/branches';
        apply((await api<Branch[]>(endpoint)).filter((branch) => branch.active));
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
  const cashierRoute = route === '/cashier' || route.startsWith('/cashier/');
  const productMatch = route.match(/^\/(?:admin\/|cashier\/)?products\/([0-9a-f-]{36})$/i);
  const supplierMatch = route.match(/^\/(?:admin\/)?suppliers\/([0-9a-f-]{36})$/i);
  const branchMatch = route.match(/^\/(?:admin\/)?branches\/([0-9a-f-]{36})$/i);
  const roleMatch = route.match(/^\/(?:admin\/)?roles\/([0-9a-f-]{36})$/i);
  const orderMatch = route.match(/^\/admin\/purchase-orders\/([0-9a-f-]{36})$/i);
  const purchaseMatch = route.match(/^\/admin\/purchases\/([0-9a-f-]{36})$/i);
  const saleMatch = route.match(/^\/admin\/sales\/([0-9a-f-]{36})$/i);
  const requiredPermission =
    routePermissions[route] ??
    (productMatch
      ? 'products.view'
      : supplierMatch
      ? 'suppliers.view'
      : roleMatch
        ? 'roles.view'
        : orderMatch
          ? 'purchaseOrders.view'
          : purchaseMatch
            ? 'purchases.view'
            : saleMatch
              ? 'sales.view'
              : undefined);
  const panelPermission = route === '/' || cashierRoute ? 'panels.cashier' : 'panels.admin';
  if (!hasPermission(me, panelPermission) || (requiredPermission && !hasPermission(me, requiredPermission)))
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Acceso denegado</h1>
          <p className="mt-2 text-slate-500">
            Tu rol no tiene acceso a este panel o a esta función.
          </p>
          {hasPermission(me, 'panels.cashier') && <a className="btn-primary mt-4" href={import.meta.env.BASE_URL}>Ir al panel de caja</a>}
          {hasPermission(me, 'panels.admin') && <a className="btn-secondary mt-4" href={import.meta.env.BASE_URL + 'admin'}>Ir al panel del dueño</a>}
        </div>
      </div>
    );
  if (route === '/') {
    if (!hasPermission(me, 'sales.access'))
      return (
        <div className="grid min-h-screen place-items-center">
          <div className="card p-8">
            <h1>Acceso denegado</h1>
            <p>Tu rol no puede acceder al POS.</p>
            <a className="btn-primary mt-4" href={import.meta.env.BASE_URL + 'admin'}>
              Ir a administración
            </a>
          </div>
        </div>
      );
    return (
      <>
        <Pos me={me} branches={branches} branchId={currentBranchId} />
        <PwaManager />
      </>
    );
  }
  if (cashierRoute) {
    const cashierPage = productMatch ? <ProductDetail id={productMatch[1]} /> : route === '/cashier/products' ? <Products /> : route === '/cashier/stock' ? <Stock /> : route === '/cashier/sales' ? <SalesAdmin kind="sales" /> : route === '/cashier/labels' ? <Labels /> : <CashierHome me={me} />;
    return <><CashierLayout me={me}>{cashierPage}</CashierLayout><PwaManager /></>;
  }
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
  ) : saleMatch ? (
    <SaleDetail id={saleMatch[1]} me={me} />
  ) : route === '/settings' && !hasPermission(me, 'branches.settings') ? (
    <div className="card p-6">No tenés permiso para configurar este dispositivo.</div>
  ) : (
    (pages[route] ?? pages['/admin'])
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
