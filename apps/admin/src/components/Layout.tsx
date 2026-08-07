import { useState } from 'react';
import {
  Boxes,
  Building2,
  ChevronLeft,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  X,
} from 'lucide-react';
import type { Me } from '../lib/api';
import { can } from '../lib/api';
import { SyncIndicator } from './SyncIndicator';
import type { Branch } from '../pages/Branches';
const items = [
  ['/', 'Inicio', LayoutDashboard, 'dashboard.view'],
  ['/branches', 'Sucursales', Building2, 'branches.view'],
  ['/users', 'Usuarios', Users, 'users.view'],
  ['/products', 'Productos', PackageSearch, 'products.view'],
  ['/categories', 'Categorías', FolderTree, 'categories.view'],
  ['/brands', 'Marcas', Tags, 'brands.view'],
  ['/roles', 'Roles y permisos', ShieldCheck, 'roles.view'],
  ['/settings', 'Configuración', Settings, 'branches.update'],
] as const;
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
    [drawer, setDrawer] = useState(false);
  const sidebar = (
    <>
      <div className="mb-6 flex items-center gap-3 px-2 py-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500">
          <Boxes />
        </span>
        {!collapsed && <b>{me.company.name}</b>}
        <button className="ml-auto lg:hidden" onClick={() => setDrawer(false)} aria-label="Cerrar menú">
          <X />
        </button>
      </div>
      <nav className="space-y-1">
        {items
          .filter((i) => can(me, i[3]))
          .map(([to, label, Icon]) => (
            <a
              key={to}
              href={to}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm ${location.pathname === to ? 'bg-white/15 text-white' : 'text-emerald-100 hover:bg-white/10'}`}
            >
              <Icon size={20} />
              {!collapsed && label}
            </a>
          ))}
      </nav>
      <button
        className="mt-auto flex min-h-12 items-center gap-3 rounded-xl p-3 text-sm text-emerald-100 hover:bg-white/10"
        onClick={() => {
          sessionStorage.clear();
          location.href = '/login';
        }}
      >
        <LogOut size={20} />
        {!collapsed && 'Cerrar sesión'}
      </button>
    </>
  );
  return (
    <div className={`grid min-h-screen ${collapsed ? 'lg:grid-cols-[82px_1fr]' : 'lg:grid-cols-[260px_1fr]'}`}>
      <aside className="hidden bg-brand-900 p-4 text-white lg:flex lg:flex-col">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setDrawer(false)}>
          <aside
            className="flex h-full w-[min(86vw,320px)] flex-col bg-brand-900 p-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}
      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <button
            className="rounded-lg p-3 hover:bg-slate-100"
            onClick={() => (window.innerWidth < 1024 ? setDrawer(true) : setCollapsed(!collapsed))}
            aria-label="Abrir navegación"
          >
            {collapsed ? <Menu /> : <ChevronLeft className="hidden lg:block" />}
            <Menu className="lg:hidden" />
          </button>
          <SyncIndicator />
          <div className="hidden text-right md:block">
            <b>
              {me.user.firstName} {me.user.lastName}
            </b>
            <div className="flex items-center justify-end gap-2 text-sm text-slate-500">
              {branches.length > 1 ? (
                <select
                  className="h-9 border-0 bg-transparent py-0 text-right text-sm"
                  value={currentBranchId ?? ''}
                  onChange={(event) => void onBranchChange(event.target.value || undefined)}
                  aria-label="Sucursal actual"
                >
                  {!me.branch && <option value="">Todas las sucursales</option>}
                  {branches.map((branch) => (
                    <option value={branch.id} key={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{branches[0]?.name ?? me.branch?.name ?? 'Sin sucursal activa'}</span>
              )}
              <span>· {me.user.roles.map((r) => r.code).join(', ')}</span>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-5 lg:p-8">{children}</main>
      </section>
    </div>
  );
}
