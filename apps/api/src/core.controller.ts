import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CurrentSession, SessionGuard } from './session';
import { Session } from './auth.service';

@Controller()
export class CoreController {
  constructor(private readonly db: PrismaService) {}
  @Get('health') health() { return { status: 'ok', service: 'rincon-api' }; }
  @Get('company') @UseGuards(SessionGuard)
  company(@CurrentSession() session: Session) { return this.db.company.findUniqueOrThrow({ where: { id: session.companyId } }); }
  @Get('branches') @UseGuards(SessionGuard)
  branches(@CurrentSession() session: Session) { return this.db.branch.findMany({ where: { companyId: session.companyId, deletedAt: null, ...(session.branchId ? { id: session.branchId } : {}) }, orderBy: { name: 'asc' } }); }
  @Get('users') @UseGuards(SessionGuard)
  users(@CurrentSession() session: Session) { return this.db.user.findMany({ where: { companyId: session.companyId, deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }, select: { id: true, username: true, email: true, firstName: true, lastName: true, active: true, branch: { select: { name: true } }, role: { select: { code: true, name: true } } } }); }
}
