import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { Unit } from '@prisma/client';
import { Session } from './auth.service';
import { CatalogService } from './catalog.service';
import { CurrentSession, RequirePermissions, SessionGuard } from './session';
export class ProductDto {
  @IsString() @MinLength(2) internalCode!: string;
  @IsString() @MinLength(2) name!: string;
  @IsUUID() categoryId!: string;
  @IsEnum(Unit) unit: Unit = Unit.UNIT;
  @Matches(/^\d+(\.\d{1,2})?$/) cost!: string;
  @Matches(/^\d+(\.\d{1,2})?$/) generalPrice!: string;
  @IsOptional() @IsString() barcode?: string;
}
class BranchProductDto { @IsOptional() @Matches(/^\d+(\.\d{1,2})?$/) price?: string; @IsOptional() @Matches(/^\d+(\.\d{1,3})?$/) minimumStock?: string; }
@Controller() @UseGuards(SessionGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get('categories') @RequirePermissions('productos.ver') categories(@CurrentSession() s: Session) { return this.catalog.categories(s); }
  @Get('products') @RequirePermissions('productos.ver') products(@CurrentSession() s: Session, @Query('search') q?: string) { return this.catalog.products(s, q); }
  @Post('products') @RequirePermissions('productos.crear') create(@CurrentSession() s: Session, @Body() dto: ProductDto) { return this.catalog.createProduct(s, dto); }
  @Patch('products/:productId/branches/:branchId') @RequirePermissions('productos.editar') branch(@CurrentSession() s: Session, @Param('productId') p: string, @Param('branchId') b: string, @Body() dto: BranchProductDto) { return this.catalog.updateBranch(s, p, b, dto.price, dto.minimumStock); }
}
