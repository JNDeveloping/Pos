import { Boxes, PackagePlus, Printer, ReceiptText, ShoppingCart } from 'lucide-react';
import type { Me } from '../lib/api';
import { can } from '../lib/api';
import { appPath } from '../lib/navigation';

const actions = [
  ['/', 'Abrir POS', 'Vender con scanner, teclado o pantalla táctil.', ShoppingCart, 'sales.access'],
  ['/cashier/products', 'Productos', 'Crear productos y modificar precios según los permisos del rol.', PackagePlus, 'products.view'],
  ['/cashier/stock', 'Stock', 'Consultar o ajustar existencias autorizadas.', Boxes, 'stock.view'],
  ['/cashier/sales', 'Ventas', 'Consultar tickets y operaciones recientes.', ReceiptText, 'sales.view'],
  ['/cashier/labels', 'Etiquetas', 'Generar etiquetas sin ingresar a administración.', Printer, 'labels.view'],
] as const;

export function CashierHome({ me }: { me: Me }) {
  return <div className="space-y-6"><header className="page-heading"><div><p className="eyebrow">OPERACIÓN DIARIA</p><h1>Herramientas de caja</h1><p>Este panel sólo muestra lo que el rol tiene autorizado. El dueño lo personaliza desde Usuarios y permisos.</p></div><a className="btn-primary" href={appPath('/')}>Abrir POS</a></header><section className="cashier-action-grid">{actions.filter((item) => can(me, item[4])).map(([to, title, description, Icon]) => <a href={appPath(to)} key={to}><span><Icon/></span><div><h2>{title}</h2><p>{description}</p></div></a>)}</section></div>;
}
