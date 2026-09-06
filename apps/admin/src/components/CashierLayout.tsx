import { Boxes, ClipboardList, LogOut, PackagePlus, Printer, ShoppingCart, Store } from 'lucide-react';
import type { Me } from '../lib/api';
import { can } from '../lib/api';
import { clearTokens } from '../lib/auth-session';
import { appPath, currentRoute, navigate } from '../lib/navigation';
import { FullscreenButton } from './FullscreenButton';

const tools = [
  ['/cashier', 'Caja', Store, 'sales.access'],
  ['/cashier/products', 'Productos', PackagePlus, 'products.view'],
  ['/cashier/stock', 'Stock', Boxes, 'stock.view'],
  ['/cashier/sales', 'Ventas', ClipboardList, 'sales.view'],
  ['/cashier/labels', 'Etiquetas', Printer, 'labels.view'],
] as const;

export function CashierLayout({ me, children }: { me: Me; children: React.ReactNode }) {
  const route = currentRoute();
  return (
    <div className="cashier-shell">
      <header className="cashier-header">
        <a className="cashier-brand" href={appPath('/')}><ShoppingCart/><span><b>Panel de caja</b><small>{me.company.name}</small></span></a>
        <nav>{tools.filter((item) => can(me, item[3])).map(([to, label, Icon]) => <a className={route === to ? 'active' : ''} href={appPath(to)} key={to}><Icon/>{label}</a>)}</nav>
        {can(me, 'panels.admin') && <a className="cashier-owner-link" href={appPath('/admin')}>Panel del dueño</a>}
        <FullscreenButton />
        <button className="icon-button" title="Cerrar sesión" onClick={() => { clearTokens(); navigate('/login'); }}><LogOut/></button>
      </header>
      <main className="cashier-content">{children}</main>
    </div>
  );
}
