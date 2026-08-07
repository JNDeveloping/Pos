import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, Session } from './auth.service';
export const PERMISSIONS = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS, permissions);
export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<{ session: Session }>().session);
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; session?: Session }>();
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('Falta autenticación');
    const session = await this.auth.session(token); request.session = session;
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    return required.every((permission) => session.permissions.includes(permission));
  }
}
