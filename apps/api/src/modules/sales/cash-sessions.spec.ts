import { BadRequestException } from '@nestjs/common';
import type { Session } from '../../common/auth';
import { CashSessionsController } from './sales.module';

const base: Session = { sub: 'cashier', companyId: 'company', branchId: null, roles: [], permissions: ['sales.access', 'cashSessions.open', 'cashSessions.close'], tokenVersion: 0 };

describe('apertura rápida de caja', () => {
  it('lista únicamente sucursales habilitadas directa o explícitamente para el usuario', async () => {
    const db = { branch: { findMany: jest.fn().mockResolvedValue([{ id: 'branch' }]) } };
    const controller = new CashSessionsController(db as never);
    await expect(controller.branches(base)).resolves.toEqual([{ id: 'branch' }]);
    expect(db.branch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ userAccesses: { some: { userId: 'cashier' } } })]) }) }));
  });
  it('no permite que un cajero abra una sesión a nombre de otro usuario', async () => {
    const db = { branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', name: 'Principal' }) } };
    const controller = new CashSessionsController(db as never);
    await expect(controller.open(base, { branchId: 'branch', cashierUserId: 'other', openingAmount: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('devuelve terminales y cajeros de la empresa/sucursal', async () => {
    const db = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', name: 'Principal' }) },
      terminal: { findMany: jest.fn().mockResolvedValue([{ id: 'terminal' }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'cashier' }]) },
    };
    const controller = new CashSessionsController(db as never);
    await expect(controller.bootstrap(base, 'branch')).resolves.toEqual({ branch: { id: 'branch', name: 'Principal' }, terminals: [{ id: 'terminal' }], cashiers: [{ id: 'cashier' }] });
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cashier' }) }));
  });
  it('cierra la caja, registra el importe y audita al responsable', async () => {
    const current = { id: 'session', companyId: 'company', branchId: 'branch', terminalId: 'terminal', cashierUserId: 'cashier', openingAmount: 100, terminal: {}, cashier: {} };
    const tx = { cashSession: { update: jest.fn().mockResolvedValue({ ...current, status: 'CLOSED' }) }, auditLog: { create: jest.fn() } };
    const db = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', name: 'Principal' }) },
      cashSession: { findFirst: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const controller = new CashSessionsController(db as never);
    await expect(controller.close(base, { cashSessionId: 'session', closingAmount: 125, closingNote: 'Sin diferencias' })).resolves.toMatchObject({ status: 'CLOSED' });
    expect(tx.cashSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED', closingAmount: 125, closedByUserId: 'cashier' }) }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
