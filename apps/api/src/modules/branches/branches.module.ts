import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsNumberString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrentSession, RequirePermissions, Session } from '../../common/auth';
import { PrismaService } from '../../prisma.service';
class BranchDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Length(2, 20) code!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() businessHours?: string;
  @IsOptional() @IsNumberString() defaultMargin?: string;
  @IsOptional() @IsNumberString() defaultTaxRate?: string;
  @IsOptional() @IsBoolean() allowDiscounts?: boolean;
  @IsOptional() @IsNumberString() maxDiscount?: string;
  @IsOptional() @IsBoolean() allowManualPrice?: boolean;
  @IsOptional() @IsBoolean() requireCashOpen?: boolean;
  @IsOptional() @IsBoolean() autoPrintTicket?: boolean;
  @IsOptional() @IsIn([58, 80]) ticketWidth?: number;
  @IsOptional() @IsBoolean() pricesIncludeTax?: boolean;
  @IsOptional() @IsString() ticketTradeName?: string;
  @IsOptional() @IsString() ticketAddress?: string;
  @IsOptional() @IsString() ticketPhone?: string;
  @IsOptional() @IsString() ticketFooter?: string;
  @IsOptional() @IsBoolean() ticketShowCuit?: boolean;
  @IsOptional() @IsBoolean() ticketShowCashier?: boolean;
  @IsOptional() @IsBoolean() ticketShowSaleCode?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() copyFromBranchId?: string;
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
  @Post() @RequirePermissions('branches.create') async create(@CurrentSession() s: Session, @Body() d: BranchDto) {
    const { copyFromBranchId, ...branchData } = d;
    return this.db.$transaction(async (tx) => {
      if (copyFromBranchId) {
        const source = await tx.branch.findFirst({
          where: { id: copyFromBranchId, companyId: s.companyId, active: true, deletedAt: null },
        });
        if (!source) throw new NotFoundException('Sucursal de origen no encontrada');
      }
      const branch = await tx.branch.create({
        data: { ...branchData, code: d.code.toUpperCase(), companyId: s.companyId },
      });
      if (copyFromBranchId) {
        const sourceProducts = await tx.branchProduct.findMany({ where: { branchId: copyFromBranchId } });
        await tx.branchProduct.createMany({
          data: sourceProducts.map(
            ({
              productId,
              cost,
              salePrice,
              margin,
              stockMinimum,
              enabled,
              posFavorite,
              allowManualPrice,
              location,
              shelf,
              internalNotes,
            }) => ({
              branchId: branch.id,
              productId,
              cost,
              salePrice,
              margin,
              stockMinimum,
              enabled,
              posFavorite,
              allowManualPrice,
              location,
              shelf,
              internalNotes,
            }),
          ),
        });
      }
      return branch;
    });
  }
  @Patch(':id') @RequirePermissions('branches.update') update(
    @CurrentSession() s: Session,
    @Param('id') id: string,
    @Body() d: Partial<BranchDto>,
  ) {
    const branchData = { ...d };
    delete branchData.copyFromBranchId;
    return this.db.branch.update({
      where: { id, companyId: s.companyId },
      data: { ...branchData, code: d.code?.toUpperCase() },
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
