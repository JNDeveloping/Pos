import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class CategoryDto {
  @IsString() @Length(2, 100) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
@Controller('categories')
class C {
  constructor(private db: PrismaService) {}
  @Get() @RequirePermissions('categories.view') list(@CurrentSession() s: Session) {
    return this.db.category.findMany({
      where: { companyId: s.companyId, deletedAt: null },
      include: { parent: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  @Post() @RequirePermissions('categories.manage') create(@CurrentSession() s: Session, @Body() d: CategoryDto) {
    return this.db.category.create({ data: { ...d, companyId: s.companyId } });
  }
  @Patch(':id') @RequirePermissions('categories.manage') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: Partial<CategoryDto>,
  ) {
    return this.db.category.update({ where: { id, companyId: s.companyId }, data: d });
  }
  @Delete(':id') @RequirePermissions('categories.manage') remove(
    @CurrentSession() s: Session,
    @Param('id') id: string,
  ) {
    return this.db.category.update({
      where: { id, companyId: s.companyId },
      data: { active: false, deletedAt: new Date() },
    });
  }
}
@Module({ controllers: [C] })
export class CategoriesModule {}
