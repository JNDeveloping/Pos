import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Prisma } from '@prisma/client';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class PermissionsDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) permissionIds!: string[];
}
class RoleDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,29}$/) code!: string;
  @IsOptional() @IsString() description?: string;
}
class UpdateRoleDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
@Controller('roles')
class RolesController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('roles.view') list(@CurrentSession() s: Session) {
    return this.db.role.findMany({
      where: { companyId: s.companyId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: [{ systemRole: 'desc' }, { name: 'asc' }],
    });
  }
  @Get('permissions') @RequirePermissions('roles.view') permissions(@CurrentSession() s: Session) {
    return this.db.permission.findMany({
      where: { companyId: s.companyId },
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
  }
  @Get(':id') @RequirePermissions('roles.view') async get(@CurrentSession() s: Session, @Param('id') id: string) {
    const role = await this.db.role.findFirst({
      where: { id, companyId: s.companyId },
      include: {
        permissions: { include: { permission: true } },
        users: {
          include: { user: { select: { id: true, username: true, firstName: true, lastName: true, active: true } } },
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }
  @Post() @RequirePermissions('roles.manage') async create(@CurrentSession() s: Session, @Body() d: RoleDto) {
    const role = await this.db.role.create({
      data: { companyId: s.companyId, name: d.name, code: d.code, description: d.description },
    });
    await this.audit(s, role.id, 'ROLE_CREATED', undefined, role);
    return role;
  }
  @Patch(':id') @RequirePermissions('roles.manage') async update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: UpdateRoleDto,
  ) {
    const old = await this.role(s, id);
    if (old.code === 'SUPER_ADMIN' && d.active === false)
      throw new BadRequestException('SUPER_ADMIN no puede desactivarse');
    const role = await this.db.role.update({ where: { id }, data: d });
    await this.audit(s, id, 'ROLE_UPDATED', old, role);
    return role;
  }
  @Put(':id/permissions') @RequirePermissions('roles.manage') async set(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: PermissionsDto,
  ) {
    const role = await this.role(s, id);
    const all = await this.db.permission.findMany({
      where: { companyId: s.companyId },
      select: { id: true, code: true },
    });
    if (role.code === 'SUPER_ADMIN') {
      d.permissionIds = all.map((x) => x.id);
    } else {
      const valid = new Set(all.map((x) => x.id));
      if (d.permissionIds.some((id) => !valid.has(id))) throw new BadRequestException('Permiso inválido');
      if (!s.roles.includes('SUPER_ADMIN')) {
        const allowed = new Set(all.filter((x) => s.permissions.includes(x.code)).map((x) => x.id));
        if (d.permissionIds.some((id) => !allowed.has(id)))
          throw new ForbiddenException('No puede asignar permisos que usted no posee');
      }
    }
    const before = role.permissions.map((x) => x.permissionId);
    await this.db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (d.permissionIds.length)
        await tx.rolePermission.createMany({
          data: d.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      await tx.auditLog.create({
        data: {
          companyId: s.companyId,
          userId: s.sub,
          entityType: 'ROLE',
          entityId: id,
          action: 'ROLE_PERMISSIONS_UPDATED',
          before: { permissionIds: before },
          after: { permissionIds: d.permissionIds },
        },
      });
    });
    return { success: true, permissionIds: d.permissionIds };
  }
  private async role(s: Session, id: string) {
    const role = await this.db.role.findFirst({
      where: { id, companyId: s.companyId },
      include: { permissions: true },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }
  private audit(s: Session, id: string, action: string, before?: unknown, after?: unknown) {
    return this.db.auditLog.create({
      data: {
        companyId: s.companyId,
        userId: s.sub,
        entityType: 'ROLE',
        entityId: id,
        action,
        before: before ? this.json(before) : undefined,
        after: after ? this.json(after) : undefined,
      },
    });
  }
  private json(v: unknown) {
    return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
  }
}
@Module({ controllers: [RolesController] })
export class RolesModule {}
