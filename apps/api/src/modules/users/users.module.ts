import { ApiTags } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { hash } from 'argon2';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class CreateUserDto {
  @IsString() @Length(3, 50) username!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @Length(2, 80) firstName!: string;
  @IsString() @Length(2, 80) lastName!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) roleIds!: string[];
}
class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @ValidateIf((o) => o.password) @MinLength(8) password?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) roleIds?: string[];
}
@ApiTags('Usuarios')
@Controller('users')
class C {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('users.view') list(@CurrentSession() s: Session) {
    return this.db.user.findMany({
      where: { companyId: s.companyId, deletedAt: null, ...(s.branchId ? { branchId: s.branchId } : {}) },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        active: true,
        lastLoginAt: true,
        branch: true,
        roles: { select: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
      orderBy: { firstName: 'asc' },
    });
  }
  @Post() @RequirePermissions('users.create') async create(@CurrentSession() s: Session, @Body() d: CreateUserDto) {
    await this.validateScope(s, d.roleIds, d.branchId);
    return this.db.user.create({
      data: {
        companyId: s.companyId,
        branchId: d.branchId,
        username: d.username,
        email: d.email?.toLowerCase(),
        passwordHash: await hash(d.password),
        firstName: d.firstName,
        lastName: d.lastName,
        roles: { create: d.roleIds.map((roleId) => ({ roleId })) },
      },
      select: { id: true, username: true },
    });
  }
  @Patch(':id') @RequirePermissions('users.update') async update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: UpdateUserDto,
  ) {
    const current = await this.db.user.findFirstOrThrow({
      where: { id, companyId: s.companyId },
      include: { roles: { include: { role: true } } },
    });
    if (id === s.sub && d.roleIds && !s.roles.includes('SUPER_ADMIN'))
      throw new ForbiddenException('No puede modificar sus propios roles');
    if (
      current.roles.some(({ role }) => role.code === 'SUPER_ADMIN') &&
      (d.active === false || (d.roleIds && !(await this.includesSuperAdmin(s.companyId, d.roleIds))))
    ) {
      const superAdmins = await this.db.userRole.count({
        where: { role: { companyId: s.companyId, code: 'SUPER_ADMIN' }, user: { active: true, deletedAt: null } },
      });
      if (superAdmins <= 1) throw new BadRequestException('No se puede bloquear al último SUPER_ADMIN');
    }
    if (d.roleIds || d.branchId) await this.validateScope(s, d.roleIds ?? [], d.branchId);
    return this.db.$transaction(async (tx) => {
      if (d.roleIds) {
        const before = current.roles.map(({ roleId }) => roleId);
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: d.roleIds.map((roleId) => ({ userId: id, roleId })) });
        await tx.auditLog.create({
          data: {
            companyId: s.companyId,
            userId: s.sub,
            entityType: 'USER',
            entityId: id,
            action: 'USER_ROLES_UPDATED',
            before: { roleIds: before },
            after: { roleIds: d.roleIds },
          },
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          email: d.email?.toLowerCase(),
          firstName: d.firstName,
          lastName: d.lastName,
          branchId: d.branchId,
          active: d.active,
          ...(d.password ? { passwordHash: await hash(d.password) } : {}),
        },
        select: { id: true, username: true },
      });
    });
  }
  @Delete(':id') @RequirePermissions('users.delete') async remove(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    const target = await this.db.user.findFirstOrThrow({
      where: { id, companyId: s.companyId },
      include: { roles: { include: { role: true } } },
    });
    if (target.roles.some(({ role }) => role.code === 'SUPER_ADMIN')) {
      const count = await this.db.userRole.count({
        where: { role: { companyId: s.companyId, code: 'SUPER_ADMIN' }, user: { active: true, deletedAt: null } },
      });
      if (count <= 1) throw new BadRequestException('No se puede eliminar al último SUPER_ADMIN');
    }
    return this.db.user.update({
      where: { id, companyId: s.companyId },
      data: { active: false, deletedAt: new Date(), refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
  }
  private async validateScope(s: Session, roleIds: string[], branchId?: string) {
    const roles = await this.db.role.findMany({ where: { id: { in: roleIds }, companyId: s.companyId, active: true } });
    if (roles.length !== roleIds.length) throw new BadRequestException('Rol inválido');
    if (!s.roles.includes('SUPER_ADMIN') && roles.some((role) => role.code === 'SUPER_ADMIN'))
      throw new ForbiddenException('Solo SUPER_ADMIN puede asignar ese rol');
    if (branchId)
      await this.db.branch.findFirstOrThrow({ where: { id: branchId, companyId: s.companyId, deletedAt: null } });
  }
  private async includesSuperAdmin(companyId: string, roleIds: string[]) {
    return Boolean(await this.db.role.findFirst({ where: { id: { in: roleIds }, companyId, code: 'SUPER_ADMIN' } }));
  }
}
@Module({ controllers: [C] })
export class UsersModule {}
