import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common';
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
        roles: { select: { role: true } },
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
    await this.db.user.findFirstOrThrow({ where: { id, companyId: s.companyId } });
    if (d.roleIds || d.branchId) await this.validateScope(s, d.roleIds ?? [], d.branchId);
    return this.db.$transaction(async (tx) => {
      if (d.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: d.roleIds.map((roleId) => ({ userId: id, roleId })) });
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
  @Delete(':id') @RequirePermissions('users.delete') remove(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.db.user.update({
      where: { id, companyId: s.companyId },
      data: { active: false, deletedAt: new Date(), refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
  }
  private async validateScope(s: Session, roleIds: string[], branchId?: string) {
    const roles = await this.db.role.count({ where: { id: { in: roleIds }, companyId: s.companyId, active: true } });
    if (roles !== roleIds.length) throw new Error('Rol inválido');
    if (branchId)
      await this.db.branch.findFirstOrThrow({ where: { id: branchId, companyId: s.companyId, deletedAt: null } });
  }
}
@Module({ controllers: [C] })
export class UsersModule {}
