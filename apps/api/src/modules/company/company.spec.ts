import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Session } from '../../common/auth';
import { SettingsController } from './company.module';

const session: Session = {
  sub: '11111111-1111-1111-1111-111111111111',
  companyId: '22222222-2222-2222-2222-222222222222',
  branchId: '33333333-3333-3333-3333-333333333333',
  roles: ['SUPER_ADMIN'],
  permissions: [],
  tokenVersion: 0,
};

describe('SettingsController tenant scope', () => {
  it('rechaza configurar otra sucursal aunque el usuario tenga permiso', async () => {
    const db = { branch: { findFirst: jest.fn() } };
    const controller = new SettingsController(db as never);
    await expect(controller.get(session, '44444444-4444-4444-4444-444444444444')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.branch.findFirst).not.toHaveBeenCalled();
  });

  it('no permite usar el id de una sucursal de otra empresa', async () => {
    const db = { branch: { findFirst: jest.fn().mockResolvedValue(null) } };
    const controller = new SettingsController(db as never);
    await expect(controller.get({ ...session, branchId: null }, '44444444-4444-4444-4444-444444444444')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.branch.findFirst).toHaveBeenCalledWith({
      where: {
        id: '44444444-4444-4444-4444-444444444444',
        companyId: session.companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
  });
});
