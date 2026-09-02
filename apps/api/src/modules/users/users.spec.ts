import { BadRequestException } from '@nestjs/common';
import type { Session } from '../../common/auth';
import { UsersController } from './users.module';

const session: Session = { sub: 'admin', companyId: 'company', branchId: null, roles: ['SUPER_ADMIN'], permissions: [], tokenVersion: 0 };

describe('administración de usuarios', () => {
  it('impide que el operador elimine su propia cuenta', async () => {
    const controller = new UsersController({} as never);
    await expect(controller.remove(session, 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('cambiar contraseña revoca las sesiones anteriores y deja auditoría', async () => {
    const current = { id: 'user', email: 'old@test.local', firstName: 'Ana', lastName: 'Caja', active: true, roles: [] };
    const tx = { user: { update: jest.fn().mockResolvedValue({ id: 'user', username: 'ana' }) }, auditLog: { create: jest.fn() } };
    const db = { user: { findFirstOrThrow: jest.fn().mockResolvedValue(current) }, $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const controller = new UsersController(db as never);
    await controller.update(session, 'user', { password: 'NuevaClave123' });
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ refreshTokenHash: null, tokenVersion: { increment: 1 } }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_PASSWORD_RESET' }) }));
  });
  it('la baja es lógica, revoca sesiones y conserva auditoría', async () => {
    const target = { id: 'user', username: 'ana', active: true, roles: [] };
    const tx = { user: { update: jest.fn().mockResolvedValue({ ...target, active: false }) }, auditLog: { create: jest.fn() } };
    const db = { user: { findFirstOrThrow: jest.fn().mockResolvedValue(target) }, $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const controller = new UsersController(db as never);
    await controller.remove(session, 'user');
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ active: false, refreshTokenHash: null, tokenVersion: { increment: 1 } }) }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
