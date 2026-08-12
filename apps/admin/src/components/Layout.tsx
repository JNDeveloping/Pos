import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  DollarSign,
  FileText,
  FolderTree,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  ArrowRightLeft,
  ClipboardCheck,
  History,
  PackageX,
  AlertTriangle,
  CreditCard,
  Monitor,
  ReceiptText,
  Store,
  Users,
  X,
} from 'lucide-react';
import type { Me } from '../lib/api';
import { can } from '../lib/api';
import { ConnectionStatus } from './ConnectionStatus';
import type { Branch } from '../pages/Branches';
import { appPath, currentRoute, navigate } from '../lib/navigation';
import { clearTokens } from '../lib/auth-session';
type NavItem = readonly [string, string, LucideIcon, string];
const groups: ReadonlyArray<{ label: string; items: readonly NavItem[] }> = [
  {
    label: 'GENERAL',
    items: [
      ['/admin', 'Inicio', LayoutDashboard, 'dashboard.view'],
      ['/', 'Abrir POS', Store, 'sales.access'],
    ],
  },
  {
    label: 'VENTAS',
    items: [
      ['/admin/sales', 'Ventas', ReceiptText, 'sales.view'],
      ['/admin/payment-methods', 'Métodos de pago', CreditCard, 'paymentMethods.view'],
      ['/admin/terminals', 'Terminales', Monitor, 'terminals.view'],
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      ['/products', 'Productos', PackageSearch, 'products.view'],
      ['/catalog', 'Catálogo maestro', LibraryBig, 'products.view'],
      ['/categories', 'Categorías', FolderTree, 'categories.view'],
      ['/brands', 'Marcas', Tags, 'brands.view'],
    ],
  },
  {
    label: 'INVENTARIO',
    items: [
      ['/admin/stock', 'Stock', Boxes, 'stock.view'],
      ['/admin/stock/movements', 'Movimientos', History, 'stock.movements'],
      ['/admin/inventory', 'Inventarios', ClipboardCheck, 'inventory.view'],
      ['/admin/waste', 'Mermas', PackageX, 'waste.view'],
      ['/admin/expirations', 'Vencimientos', AlertTriangle, 'expirations.view'],
      ['/admin/transfers', 'Transferencias', ArrowRightLeft, 'transfers.view'],
    ],
  },
  {
    label: 'COMPRAS',
    items: [
      ['/admin/suppliers', 'Proveedores', Truck, 'suppliers.view'],
      ['/admin/purchase-orders', 'Órdenes de compra', FileText, 'purchaseOrders.view'],
      ['/admin/purchases', 'Compras', ShoppingCart, 'purchases.view'],
      ['/admin/invoices', 'Facturas', FileText, 'invoices.view'],
      ['/admin/invoices/analyze', 'Analizar factura', Search, 'invoices.analyze'],
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      ['/prices', 'Precios', DollarSign, 'prices.view'],
      ['/costs', 'Costos', CircleDollarSign, 'costs.view'],
      ['/price-lists', 'Listas de precios', Tags, 'priceLists.view'],
      ['/labels', 'Etiquetas', Printer, 'labels.view'],
    ],
  },
  {
    label: 'ADMINISTRACIÓN',
    items: [
      ['/branches', 'Sucursales', Building2, 'branches.view'],
      ['/users', 'Usuarios', Users, 'users.view'],
      ['/roles', 'Roles y permisos', ShieldCheck, 'roles.view'],
      ['/audit', 'Auditoría', FileText, 'audit.view'],
      ['/settings', 'Configuración', Settings, 'branches.settings'],
    ],
  },
];
export function Layout({
  me,
  branches,
  currentBranchId,
  onBranchChange,
  children,
}: {
  me: Me;
  branches: Branch[];
  currentBranchId?: string;
  onBranchChange: (branchId?: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [profile, setProfile] = useState(false);
  const route = currentRoute();
  const sidebar = (
    <>
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Boxes size={22} />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <b className="block truncate">{me.company.name}</b>
            <small>Administración ERP</small>
          </span>
        )}
        <button
          className="ml-auto rounded-lg p-2 hover:bg-white/10 lg:hidden"
          onClick={() => setDrawer(false)}
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {groups.map((group) => {
          const visible = group.items.filter((i) => can(me, i[3]));
          return visible.length ? (
            <div key={group.label} className="nav-group">
              {!collapsed && <p className="nav-label">{group.label}</p>}
              {visible.map(([to, label, Icon]) => (
                <a
                  key={to}
                  href={appPath(to)}
                  title={collapsed ? label : undefined}
                  className={`nav-item ${route === to ? 'nav-item-active' : ''}`}
                >
                  <Icon size={18} />
                  {!collapsed && <span>{label}</span>}
                  {!collapsed && route === to && <ChevronRight className="ml-auto" size={15} />}
                </a>
              ))}
            </div>
          ) : null;
        })}
      </nav>
      <button
        className="nav-item mt-auto text-slate-500"
        onClick={() => {
          clearTokens();
          navigate('/login');
        }}
      >
        <LogOut size={18} />
        {!collapsed && 'Cerrar sesión'}
      </button>
    </>
  );
  return (
    <div className={`app-shell ${collapsed ? 'lg:grid-cols-[88px_1fr]' : 'lg:grid-cols-[268px_1fr]'}`}>
      <aside className="sidebar hidden lg:flex">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="sidebar flex h-full w-[min(88vw,300px)]" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <section className="min-w-0">
        <header className="topbar">
          <div className="flex items-center gap-2">
            <button className="icon-button lg:hidden" onClick={() => setDrawer(true)} aria-label="Abrir navegación">
              <Menu />
            </button>
            <button
              className="icon-button hidden lg:grid"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Contraer navegación"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </div>
          <label className="global-search">
            <Search size={18} />
            <input placeholder="Buscar productos, proveedores, facturas…" aria-label="Búsqueda global" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <ConnectionStatus />
            <button className="icon-button hidden sm:grid" aria-label="Notificaciones">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <div className="relative">
              <button className="profile-button" onClick={() => setProfile(!profile)}>
                <span className="avatar">
                  {me.user.firstName[0]}
                  {me.user.lastName[0]}
                </span>
                <span className="hidden text-left md:block">
                  <b>
                    {me.user.firstName} {me.user.lastName}
                  </b>
                  <small>{me.user.roles.map((r) => r.code).join(', ')}</small>
                </span>
              </button>
              {profile && (
                <div className="profile-menu">
                  <p className="border-b p-3 text-sm font-semibold">{me.user.username}</p>
                  <button
                    onClick={() => {
                      clearTokens();
                      navigate('/login');
                    }}
                  >
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="context-bar">
          <div>
            <span className="text-slate-400">Panel</span>
            <ChevronRight size={14} />
            <b>{groups.flatMap((g) => g.items).find((i) => i[0] === route)?.[1] ?? 'Inicio'}</b>
          </div>
          {branches.length > 0 && (
            <label className="branch-select">
              <Building2 size={15} />
              <select value={currentBranchId ?? ''} onChange={(e) => void onBranchChange(e.target.value || undefined)}>
                {!me.branch && <option value="">Todas las sucursales</option>}
                {branches.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <main className="page-content">{children}</main>
      </section>
    </div>
  );
}
