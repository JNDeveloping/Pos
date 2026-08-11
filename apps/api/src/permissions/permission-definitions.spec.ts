import { adminPermissionCodes, permissionCodes, permissionDefinitions } from './permission-definitions';
describe('permission catalog', () => {
  it('contains unique permission codes', () => expect(new Set(permissionCodes).size).toBe(permissionCodes.length));
  it('integrates every purchasing permission', () =>
    expect(permissionCodes).toEqual(
      expect.arrayContaining([
        'suppliers.view',
        'purchaseOrders.create',
        'purchaseOrders.send',
        'purchases.confirm',
        'invoices.upload',
        'invoices.analyze',
        'invoices.review',
        'invoiceAI.use',
        'costs.applyFromPurchase',
      ]),
    ));
  it('gives ADMIN broad purchasing access but not role administration', () => {
    expect(adminPermissionCodes).toContain('invoices.analyze');
    expect(adminPermissionCodes).not.toContain('roles.manage');
  });
  it('provides UI metadata', () =>
    expect(permissionDefinitions.every((x) => x.module && x.label && Number.isInteger(x.sortOrder))).toBe(true));
});
