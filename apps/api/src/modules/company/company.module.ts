import { Controller, Get, Module } from '@nestjs/common';
import { CurrentSession, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
@Controller('company')
class C {
  constructor(private db: PrismaService) {}
  @Get() get(@CurrentSession() s: Session) {
    return this.db.company.findUniqueOrThrow({ where: { id: s.companyId } });
  }
}
@Module({ controllers: [C] })
export class CompanyModule {}
