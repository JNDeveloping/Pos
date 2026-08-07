import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
export type Session = {
  sub: string;
  companyId: string;
  branchId: string | null;
  roles: string[];
  permissions: string[];
  tokenVersion: number;
};
export const IS_PUBLIC = 'isPublic',
  PERMISSIONS = 'permissions';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const RequirePermissions = (...values: string[]) => SetMetadata(PERMISSIONS, values);
export const CurrentSession = createParamDecorator(
  (_d: unknown, c: ExecutionContext) => c.switchToHttp().getRequest<{ session: Session }>().session,
);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<{ headers: { authorization?: string }; session?: Session }>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Autenticación requerida');
    try {
      req.session = await this.jwt.verifyAsync<Session>(token, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    const needed = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (!needed.every((p) => req.session!.permissions.includes(p)))
      throw new ForbiddenException('No tiene permisos para esta operación');
    return true;
  }
}
