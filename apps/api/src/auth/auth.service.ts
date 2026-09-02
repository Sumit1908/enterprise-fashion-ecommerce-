import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../common/password.js';
import type { RegisterDto, LoginDto } from './dto.js';

const env = loadEnv();

interface TokenContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto, ctx: TokenContext) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, dto.phone ? { phone: dto.phone } : { id: '' }] },
    });
    if (existing) throw new ConflictException('An account with those details already exists');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone ?? null,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        passwordHash: await hashPassword(dto.password),
        kind: 'CUSTOMER',
        loyaltyAccount: env.FEATURE_LOYALTY ? { create: {} } : undefined,
      },
    });

    return this.issueTokens(user.id, ctx);
  }

  async login(dto: LoginDto, ctx: TokenContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === 'BANNED') throw new UnauthorizedException('Account suspended');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user.id, ctx);
  }

  /**
   * Sign in (or auto-register) a customer by an already-verified mobile number.
   * Called only after OtpService.verify() has succeeded. No password involved.
   */
  async authByVerifiedPhone(
    phoneE164: string,
    ctx: TokenContext,
    opts: { firstName?: string } = {},
  ) {
    const now = new Date();
    const found = await this.prisma.user.findUnique({ where: { phone: phoneE164 } });
    if (found?.status === 'BANNED') throw new UnauthorizedException('Account suspended');
    const isNew = !found;

    const user = found
      ? await this.prisma.user.update({
          where: { id: found.id },
          data: {
            phoneVerifiedAt: found.phoneVerifiedAt ?? now,
            lastLoginAt: now,
            ...(opts.firstName && !found.firstName ? { firstName: opts.firstName.trim() } : {}),
          },
        })
      : await this.prisma.user.create({
          data: {
            phone: phoneE164,
            phoneVerifiedAt: now,
            firstName: opts.firstName?.trim() || null,
            kind: 'CUSTOMER',
            status: 'ACTIVE',
            lastLoginAt: now,
            loyaltyAccount: env.FEATURE_LOYALTY ? { create: {} } : undefined,
          },
        });

    return { tokens: await this.issueTokens(user.id, ctx), isNew };
  }

  async refresh(rawToken: string, ctx: TokenContext) {
    const tokenHash = this.sha256(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.userId, ctx);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash: this.sha256(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        loyaltyAccount: true,
      },
    });
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      kind: user.kind,
      isSuperAdmin: user.isSuperAdmin,
      roles: user.roles.map((r) => r.role.name),
      loyaltyPoints: user.loyaltyAccount?.pointsBalance ?? 0,
    };
  }

  private async issueTokens(userId: string, ctx: TokenContext) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: Math.floor(this.ttlMs(env.JWT_ACCESS_TTL) / 1000),
      },
    );

    const rawRefresh = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs(env.JWT_REFRESH_TTL));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.sha256(rawRefresh),
        userAgent: ctx.userAgent?.slice(0, 255),
        ip: ctx.ip,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefresh, refreshExpiresAt: expiresAt };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private ttlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    return n * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[unit];
  }
}
