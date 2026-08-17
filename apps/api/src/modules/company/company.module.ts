import { Body, Controller, Get, Module, Put, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
@Controller('company')
class CompanyController {
  constructor(private db: PrismaService) {}
  @Get() get(@CurrentSession() s: Session) {
    return this.db.company.findUniqueOrThrow({ where: { id: s.companyId } });
  }
}
@Controller('settings')
class SettingsController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('branches.settings') async get(
    @CurrentSession() s: Session,
    @Query('branchId') branchId?: string,
  ) {
    const [company, branch] = await Promise.all([
      this.db.companySetting.findMany({ where: { companyId: s.companyId } }),
      branchId ? this.db.branchSetting.findMany({ where: { companyId: s.companyId, branchId } }) : [],
    ]);
    return Object.fromEntries([...company, ...branch].map((x) => [x.key, x.value]));
  }
  @Put() @RequirePermissions('branches.settings') async put(
    @CurrentSession() s: Session,
    @Query('branchId') branchId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(body)) {
        if (branchId)
          await tx.branchSetting.upsert({
            where: { branchId_key: { branchId, key } },
            create: { companyId: s.companyId, branchId, key, value: value as Prisma.InputJsonValue },
            update: { value: value as Prisma.InputJsonValue },
          });
        else
          await tx.companySetting.upsert({
            where: { companyId_key: { companyId: s.companyId, key } },
            create: { companyId: s.companyId, key, value: value as Prisma.InputJsonValue },
            update: { value: value as Prisma.InputJsonValue },
          });
      }
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          branchId,
          userId: s.sub,
          entityType: 'SETTING',
          entityId: branchId ?? s.companyId,
          action: 'SETTINGS_UPDATED',
          metadata: { keys: Object.keys(body) },
        },
      });
      return body;
    });
  }
}
@Module({ controllers: [CompanyController, SettingsController] })
export class CompanyModule {}
