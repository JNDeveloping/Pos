import { sessionCan, type Session } from './auth';

const session = (roles: string[], permissions: string[]): Session => ({
  sub: '00000000-0000-0000-0000-000000000001',
  companyId: '00000000-0000-0000-0000-000000000002',
  branchId: null,
  roles,
  permissions,
  tokenVersion: 0,
});

describe('session permission policy', () => {
  it('keeps SUPER_ADMIN as an explicit bypass for newly added permissions', () => {
    expect(sessionCan(session(['SUPER_ADMIN'], []), 'future.permission')).toBe(true);
  });
  it('requires assigned permissions for other roles', () => {
    expect(sessionCan(session(['CAJERO'], ['sales.create']), 'sales.create')).toBe(true);
    expect(sessionCan(session(['CAJERO'], ['sales.create']), 'costs.view')).toBe(false);
  });
});
