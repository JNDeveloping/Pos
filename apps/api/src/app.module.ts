import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CoreController } from './core.controller';
import { PrismaService } from './prisma.service';
import { SessionGuard } from './session';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
  controllers: [AuthController, CoreController, CatalogController],
  providers: [PrismaService, AuthService, CatalogService, SessionGuard],
})
export class AppModule {}
