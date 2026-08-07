import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class BranchDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Length(2, 20) code!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
@ApiTags('Sucursales')
@Controller('branches')
class BranchesController {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('branches.view') list(@CurrentSession() s: Session) {
    return this.db.branch.findMany({
      where: { companyId: s.companyId, deletedAt: null, ...(s.branchId ? { id: s.branchId } : {}) },
      orderBy: { name: 'asc' },
    });
  }
  @Get(':id') @RequirePermissions('branches.view') async one(@CurrentSession() s: Session, @Param('id') id: string) {
    const x = await this.db.branch.findFirst({
      where: { id, companyId: s.companyId, deletedAt: null, ...(s.branchId ? { id: s.branchId } : {}) },
    });
    if (!x) throw new NotFoundException('Sucursal no encontrada');
    return x;
  }
  @Post() @RequirePermissions('branches.create') create(@CurrentSession() s: Session, @Body() d: BranchDto) {
    return this.db.branch.create({ data: { ...d, code: d.code.toUpperCase(), companyId: s.companyId } });
  }
  @Patch(':id') @RequirePermissions('branches.update') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: Partial<BranchDto>,
  ) {
    return this.db.branch.update({
      where: { id, companyId: s.companyId },
      data: { ...d, code: d.code?.toUpperCase() },
    });
  }
  @Delete(':id') @RequirePermissions('branches.delete') remove(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.db.branch.update({
      where: { id, companyId: s.companyId },
      data: { active: false, deletedAt: new Date() },
    });
  }
}
@Module({ controllers: [BranchesController] })
export class BranchesModule {}
