export type PermissionDefinition = {
  code: string;
  module: string;
  label: string;
  description: string;
  sortOrder: number;
};
const modules: Record<string, string[]> = {
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
};
export const permissionDefinitions: PermissionDefinition[] = Object.entries(modules).flatMap(
  ([module, items], moduleIndex) =>
    items.map((entry, itemIndex) => {
      const [code, label] = entry.split('|');
      return { code, module, label, description: label, sortOrder: moduleIndex * 100 + itemIndex };
    }),
);
export const permissionCodes = permissionDefinitions.map((x) => x.code);
export const adminPermissionCodes = permissionCodes.filter(
  (code) => !['roles.manage', 'users.delete', 'branches.delete', 'stock.adjust'].includes(code),
);
export const managerPermissionCodes = permissionCodes.filter((code) =>
  [
    'dashboard.view',
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
  ].includes(code),
);
