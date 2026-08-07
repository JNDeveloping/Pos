import { Body, Controller, Get, Module, Param, Put } from '@nestjs/common';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class D {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) permissionIds!: string[];
}
@Controller('roles')
class C {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('roles.view') list(@CurrentSession() s: Session) {
    return this.db.role.findMany({
      where: { companyId: s.companyId, active: true },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }
  @Get('permissions') @RequirePermissions('roles.view') permissions(@CurrentSession() s: Session) {
    return this.db.permission.findMany({ where: { companyId: s.companyId }, orderBy: { code: 'asc' } });
  }
  @Put(':id/permissions') @RequirePermissions('roles.manage') async set(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: D,
  ) {
    await this.db.role.findFirstOrThrow({ where: { id, companyId: s.companyId } });
    return this.db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: d.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
      return { success: true };
    });
  }
}
@Module({ controllers: [C] })
export class RolesModule {}
