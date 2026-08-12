import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { CurrentSession, Public, Session } from '../../common/auth';
class LoginDto {
  @IsString() identifier!: string;
  @IsString() @MinLength(8) password!: string;
}
class RefreshDto {
  @IsString() refreshToken!: string;
}
@ApiTags('Autenticación')
@Controller('auth')
class AuthController {
  constructor(private service: AuthService) {}
  @Public() @Post('login') login(@Body() d: LoginDto) {
    return this.service.login(d);
  }
  @Public() @Post('refresh') refresh(@Body() d: RefreshDto) {
    return this.service.refresh(d.refreshToken);
  }
  @Post('logout') logout(@CurrentSession() s: Session) {
    return this.service.logout(s.sub);
  }
  @Get('me') me(@CurrentSession() s: Session) {
    return this.service.me(s);
  }
}
@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
