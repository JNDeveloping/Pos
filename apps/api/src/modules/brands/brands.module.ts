import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class D {
  @IsString() @Length(2, 100) name!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
@Controller('brands')
class C {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('brands.view') list(@CurrentSession() s: Session) {
    return this.db.brand.findMany({ where: { companyId: s.companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }
  @Post() @RequirePermissions('brands.manage') create(@CurrentSession() s: Session, @Body() d: D) {
    return this.db.brand.create({ data: { ...d, companyId: s.companyId } });
  }
  @Patch(':id') @RequirePermissions('brands.manage') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: Partial<D>,
  ) {
    return this.db.brand.update({ where: { id, companyId: s.companyId }, data: d });
  }
  @Delete(':id') @RequirePermissions('brands.manage') remove(@CurrentSession() s: Session, @Param('id') id: string) {
    return this.db.brand.update({
      where: { id, companyId: s.companyId },
      data: { active: false, deletedAt: new Date() },
    });
  }
}
@Module({ controllers: [C] })
export class BrandsModule {}
