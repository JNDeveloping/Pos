export type PermissionDefinition = {
  code: string;
  module: string;
  label: string;
  description: string;
  sortOrder: number;
  active: boolean;
};
const modules: Record<string, string[]> = {
  PANELS: [
    'panels.cashier|Ingresar al panel de caja',
    'panels.admin|Ingresar al panel de administración',
  ],
  DASHBOARD: ['dashboard.view|Ver panel'],
  PRODUCTS: [
    'products.view|Ver productos',
    'products.create|Crear productos',
    'products.update|Editar productos',
    'products.disable|Desactivar productos',
    'products.import|Importar productos',
    'products.export|Exportar productos',
    'categories.view|Ver categorías',
    'categories.manage|Administrar categorías',
    'brands.view|Ver marcas',
    'brands.manage|Administrar marcas',
  ],
  PRICES: [
    'prices.view|Ver precios',
    'prices.update|Editar precios',
    'prices.bulkUpdate|Actualización masiva de precios',
    'costs.view|Ver costos',
    'costs.update|Editar costos',
    'costs.bulkUpdate|Actualización masiva de costos',
    'costs.applyFromPurchase|Aplicar costos desde compras',
    'priceLists.view|Ver listas de precios',
    'priceLists.manage|Administrar listas de precios',
  ],
  SUPPLIERS: [
    'suppliers.view|Ver proveedores',
    'suppliers.create|Crear proveedores',
    'suppliers.update|Editar proveedores',
    'suppliers.disable|Desactivar proveedores',
  ],
  PURCHASE_ORDERS: [
    'purchaseOrders.view|Ver órdenes de compra',
    'purchaseOrders.create|Crear órdenes de compra',
    'purchaseOrders.update|Editar órdenes de compra',
    'purchaseOrders.send|Enviar órdenes de compra',
    'purchaseOrders.cancel|Cancelar órdenes de compra',
    'purchaseOrders.manage|Administrar órdenes (compatibilidad)',
  ],
  PURCHASES: [
    'purchases.view|Ver compras',
    'purchases.create|Crear compras',
    'purchases.update|Editar compras',
    'purchases.confirm|Confirmar compras',
    'purchases.cancel|Cancelar compras',
  ],
  INVOICES: [
    'invoices.view|Ver facturas',
    'invoices.upload|Subir facturas',
    'invoices.analyze|Analizar facturas',
    'invoices.review|Revisar facturas',
    'invoices.confirm|Confirmar facturas',
    'invoiceAI.use|Usar análisis IA',
    'invoiceAI.review|Revisar análisis IA',
  ],
  BRANCHES: [
    'branches.view|Ver sucursales',
    'branches.create|Crear sucursales',
    'branches.update|Editar sucursales',
    'branches.delete|Desactivar sucursales',
    'branches.settings|Configurar sucursales',
  ],
  USERS: [
    'users.view|Ver usuarios',
    'users.create|Crear usuarios',
    'users.update|Editar usuarios',
    'users.delete|Desactivar usuarios',
  ],
  ROLES: ['roles.view|Ver roles', 'roles.manage|Administrar roles y permisos'],
  OPERATIONS: [
    'labels.view|Ver etiquetas',
    'labels.generate|Generar etiquetas',
    'audit.view|Ver auditoría',
    'stock.view|Ver stock',
    'stock.adjust|Ajustar stock',
  ],
  STOCK: [
    'stock.movements|Ver movimientos de stock',
    'stock.history|Ver historial de stock',
    'stock.initialLoad|Cargar stock inicial',
    'stock.transfer|Transferir stock (compatibilidad)',
    'stock.inventory|Administrar inventarios (compatibilidad)',
    'stock.waste|Registrar mermas (compatibilidad)',
  ],
  INVENTORY: [
    'inventory.view|Ver inventarios',
    'inventory.create|Crear inventarios',
    'inventory.count|Contar inventario',
    'inventory.confirm|Confirmar inventarios',
  ],
  WASTE: ['waste.view|Ver mermas', 'waste.create|Registrar mermas'],
  EXPIRATIONS: ['expirations.view|Ver vencimientos'],
  TRANSFERS: [
    'transfers.view|Ver transferencias',
    'transfers.create|Crear transferencias',
    'transfers.send|Enviar transferencias',
    'transfers.receive|Recibir transferencias',
  ],
  SALES: [
    'sales.access|Acceder al POS',
    'sales.view|Ver ventas',
    'sales.create|Crear ventas',
    'sales.cancel|Anular ventas',
    'sales.return|Registrar devoluciones',
    'sales.discountItem|Aplicar descuento por ítem',
    'sales.discountSale|Aplicar descuento general',
    'sales.manualPrice|Ingresar precio manual',
    'sales.reprintTicket|Reimprimir tickets',
    'sales.authorizeDiscount|Autorizar descuentos',
  ],
  TERMINALS: ['terminals.view|Ver terminales', 'terminals.manage|Administrar terminales'],
  PAYMENT_METHODS: ['paymentMethods.view|Ver medios de pago', 'paymentMethods.manage|Administrar medios de pago'],
};
export const SYSTEM_PERMISSIONS: PermissionDefinition[] = Object.entries(modules).flatMap(
  ([module, items], moduleIndex) =>
    items.map((entry, itemIndex) => {
      const [code, label] = entry.split('|');
      return { code, module, label, description: label, sortOrder: moduleIndex * 100 + itemIndex, active: true };
    }),
);
/** @deprecated Use SYSTEM_PERMISSIONS. Kept as a compatibility alias. */
export const permissionDefinitions = SYSTEM_PERMISSIONS;
export const permissionCodes = SYSTEM_PERMISSIONS.map((x) => x.code);
export const adminPermissionCodes = permissionCodes.filter(
  (code) => code !== 'panels.cashier' && !['roles.manage', 'users.delete', 'branches.delete', 'stock.adjust'].includes(code),
);
export const managerPermissionCodes = permissionCodes.filter((code) =>
  [
    'dashboard.view',
    'panels.admin',
    'panels.cashier',
    'products.view',
    'products.create',
    'products.update',
    'categories.view',
    'brands.view',
    'prices.view',
    'prices.update',
    'costs.view',
    'suppliers.view',
    'suppliers.create',
    'suppliers.update',
    'purchaseOrders.view',
    'purchaseOrders.create',
    'purchaseOrders.update',
    'purchaseOrders.send',
    'purchases.view',
    'purchases.create',
    'purchases.update',
    'purchases.confirm',
    'invoices.view',
    'invoices.upload',
    'invoices.analyze',
    'invoices.review',
    'invoiceAI.use',
    'invoiceAI.review',
    'labels.view',
    'labels.generate',
    'stock.view',
    'sales.access',
    'sales.view',
    'sales.create',
    'sales.cancel',
    'sales.return',
    'sales.discountItem',
    'sales.discountSale',
    'sales.reprintTicket',
    'terminals.view',
    'paymentMethods.view',
  ].includes(code),
);
