import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY, type AuthUser } from './decorators.js';

const env = loadEnv();

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Missing bearer token');
    }

    let sub: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
      sub = payload.sub;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.status === 'BANNED' || user.deletedAt) {
      if (isPublic) return true;
      throw new UnauthorizedException('Account not available');
    }

    const permissions = new Set<string>();
    const roles: string[] = [];
    for (const ur of user.roles) {
      roles.push(ur.role.slug);
      for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
    }

    request.user = {
      id: user.id,
      kind: user.kind,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions: [...permissions],
      roles,
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookie = (request as unknown as { cookies?: Record<string, string> }).cookies?.[
      'sj_access'
    ];
    return cookie ?? null;
  }
}
