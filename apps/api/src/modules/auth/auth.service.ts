import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { PrismaService } from '../../prisma.service';
import { Session } from '../../common/auth';
@Injectable()
export class AuthService {
  constructor(
    private db: PrismaService,
    private jwt: JwtService,
  ) {}
  private secret(k: string) {
    const v = process.env[k];
    if (!v || v.length < 32) throw new Error(`${k} debe tener al menos 32 caracteres`);
    return v;
  }
  private async tokens(p: Session) {
    const accessToken = await this.jwt.signAsync(p, {
      secret: this.secret('JWT_SECRET'),
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as never,
    });
    const refreshToken = await this.jwt.signAsync(p, {
      secret: this.secret('JWT_REFRESH_SECRET'),
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as never,
    });
    await this.db.user.update({ where: { id: p.sub }, data: { refreshTokenHash: await hash(refreshToken) } });
    return { accessToken, refreshToken };
  }
  async login(d: { identifier: string; password: string }) {
    const u = await this.db.user.findFirst({
      where: { OR: [{ username: d.identifier }, { email: d.identifier.toLowerCase() }], active: true, deletedAt: null },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!u || !(await verify(u.passwordHash, d.password))) throw new UnauthorizedException('Credenciales inválidas');
    const roles = u.roles.map((r) => r.role.code),
      permissions = [...new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)))];
    const payload: Session = {
      sub: u.id,
      companyId: u.companyId,
      branchId: u.branchId,
      roles,
      permissions,
      tokenVersion: u.tokenVersion,
    };
    await this.db.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
    return {
      ...(await this.tokens(payload)),
      user: { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, roles, permissions },
    };
  }
  async refresh(token: string) {
    try {
      const p = await this.jwt.verifyAsync<Session>(token, { secret: this.secret('JWT_REFRESH_SECRET') });
      const u = await this.db.user.findUnique({
        where: { id: p.sub },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
      });
      if (
        !u?.active ||
        u.tokenVersion !== p.tokenVersion ||
        !u.refreshTokenHash ||
        !(await verify(u.refreshTokenHash, token))
      )
        throw 0;
      const roles = u.roles.filter(({ role }) => role.active).map(({ role }) => role.code);
      const permissions = [
        ...new Set(u.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code))),
      ];
      return this.tokens({ ...p, roles, permissions, tokenVersion: u.tokenVersion });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
  async logout(id: string) {
    await this.db.user.update({ where: { id }, data: { refreshTokenHash: null, tokenVersion: { increment: 1 } } });
    return { success: true };
  }
  async me(s: Session) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: s.sub },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        branch: true,
        company: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });
    const roles = user.roles.filter(({ role }) => role.active).map(({ role }) => role);
    const permissions = [
      ...new Set(roles.flatMap((role) => role.permissions.map(({ permission }) => permission.code))),
    ];
    return {
      user: { ...user, roles: roles.map(({ permissions: _permissions, ...role }) => role) },
      permissions,
      branch: user.branch,
      company: user.company,
    };
  }
}
