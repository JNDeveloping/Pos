import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './common/auth';
import { InfrastructureModule } from './infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ProductsModule } from './modules/products/products.module';
import { CompanyModule } from './modules/company/company.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { AuditModule } from './modules/audit/audit.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { StockModule } from './modules/stock/stock.module';
import { SalesModule } from './modules/sales/sales.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    JwtModule.register({ global: true }),
    InfrastructureModule,
    AuthModule,
    CompanyModule,
    DashboardModule,
    HealthModule,
    BranchesModule,
    UsersModule,
    RolesModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    CommercialModule,
    AuditModule,
    SuppliersModule,
    PurchasesModule,
    StockModule,
    SalesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
