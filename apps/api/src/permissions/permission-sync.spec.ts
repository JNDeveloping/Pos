import { planPermissionSync } from './permission-sync';
import { SYSTEM_PERMISSIONS } from './permission-definitions';
describe('permission synchronization plan', () => {
  const rows = () => SYSTEM_PERMISSIONS.map((permission) => ({ ...permission }));
  it('is idempotent on a second synchronization', () => {
    const plan = planPermissionSync(rows(), SYSTEM_PERMISSIONS);
    expect(plan.created).toHaveLength(0);
    expect(plan.updated).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(SYSTEM_PERMISSIONS.length);
  });
  it('creates missing permissions and updates metadata without deleting unknown rows', () => {
    const existing = rows().slice(1);
    existing[0] = { ...existing[0], label: 'Etiqueta manual antigua' };
    existing.push({
      code: 'legacy.keep',
      module: 'LEGACY',
      label: 'Mantener',
      description: 'No borrar',
      sortOrder: 999,
      active: true,
    });
    const plan = planPermissionSync(existing, SYSTEM_PERMISSIONS);
    expect(plan.created).toEqual([SYSTEM_PERMISSIONS[0].code]);
    expect(plan.updated).toContain(existing[0].code);
    expect(plan.undefinedCodes).toEqual(['legacy.keep']);
  });
});
