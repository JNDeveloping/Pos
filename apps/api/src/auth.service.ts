import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify, hash } from 'argon2';
import { PrismaService } from './prisma.service';

export type Session = { sub: string; companyId: string; branchId: string | null; permissions: string[]; tokenVersion: number };

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService, private readonly jwt: JwtService) {}

  async login(identifier: string, password: string) {
    const user = await this.db.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }], active: true, deletedAt: null }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
    if (!user || !(await verify(user.passwordHash, password))) throw new UnauthorizedException('Credenciales inválidas');
    const payload: Session = { sub: user.id, companyId: user.companyId, branchId: user.branchId, tokenVersion: user.tokenVersion, permissions: user.role.permissions.map((item) => item.permission.code) };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.secret('JWT_SECRET'), expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as never });
    const refreshToken = await this.jwt.signAsync(payload, { secret: this.secret('JWT_REFRESH_SECRET'), expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as never });
    await this.db.user.update({ where: { id: user.id }, data: { refreshTokenHash: await hash(refreshToken) } });
    return { accessToken, refreshToken, user: { id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role.code, branchId: user.branchId } };
  }

  async refresh(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<Session>(token, { secret: this.secret('JWT_REFRESH_SECRET') });
      const user = await this.db.user.findUnique({ where: { id: payload.sub } });
      if (!user?.active || !user.refreshTokenHash || user.tokenVersion !== payload.tokenVersion || !(await verify(user.refreshTokenHash, token))) throw new Error();
      const accessToken = await this.jwt.signAsync(payload, { secret: this.secret('JWT_SECRET'), expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as never });
      return { accessToken };
    } catch { throw new UnauthorizedException('Sesión vencida'); }
  }

  async session(token: string) {
    try { return await this.jwt.verifyAsync<Session>(token, { secret: this.secret('JWT_SECRET') }); }
    catch { throw new UnauthorizedException('Token inválido'); }
  }
  private secret(name: string) { const value = process.env[name]; if (!value || value.length < 32) throw new Error(`${name} debe tener al menos 32 caracteres`); return value; }
}
