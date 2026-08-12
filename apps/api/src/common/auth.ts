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
import { PrismaService } from '../prisma.service';
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
export const sessionCan = (session: Session, permission: string) =>
  session.roles.includes('SUPER_ADMIN') || session.permissions.includes(permission);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
    private db: PrismaService,
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
    const user = await this.db.user.findFirst({
      where: { id: req.session!.sub, companyId: req.session!.companyId, active: true, deletedAt: null },
      select: {
        tokenVersion: true,
        roles: {
          select: {
            role: {
              select: { code: true, active: true, permissions: { select: { permission: { select: { code: true } } } } },
            },
          },
        },
      },
    });
    if (!user || user.tokenVersion !== req.session!.tokenVersion) throw new UnauthorizedException('Sesión revocada');
    req.session!.roles = user.roles.filter(({ role }) => role.active).map(({ role }) => role.code);
    req.session!.permissions = [
      ...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code))),
    ];
    const needed = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (!req.session!.roles.includes('SUPER_ADMIN') && !needed.every((p) => req.session!.permissions.includes(p)))
      throw new ForbiddenException('No tiene permisos para esta operación');
    return true;
  }
}
