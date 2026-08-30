import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditAction, Prisma } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './decorators.js';

const METHOD_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * Records every mutating admin request in `AuditLog`. Read requests are ignored.
 * Attach with `@UseInterceptors(AuditInterceptor)` on admin controllers.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const action = METHOD_ACTION[req.method];

    if (!action) return next.handle();

    const user = req.user;
    const routePath = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const entityType = deriveEntity(routePath);

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          (result as { id?: string } | null)?.id ??
          (req.params as Record<string, string>)?.id ??
          null;

        void this.prisma.auditLog
          .create({
            data: {
              actorId: user?.id ?? null,
              actorLabel: user ? `${user.email ?? user.id} (${user.roles.join(', ') || 'staff'})` : null,
              action,
              entityType,
              entityId,
              summary: `${req.method} ${routePath}`,
              after: sanitize(req.body) ?? Prisma.JsonNull,
              ip: req.ip ?? null,
              userAgent: req.headers['user-agent'] ?? null,
            },
          })
          .catch(() => undefined); // auditing must never break the request
    }),
    );
  }
}

const IGNORED_SEGMENTS = /^(api|admin|v\d+)$/;

function deriveEntity(routePath: string): string {
  const seg = routePath
    .split('/')
    .filter(Boolean)
    .find((s) => !IGNORED_SEGMENTS.test(s) && !s.startsWith(':'));
  if (!seg) return 'Unknown';
  const singular = seg.endsWith('ies')
    ? `${seg.slice(0, -3)}y`
    : seg.endsWith('s')
      ? seg.slice(0, -1)
      : seg;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

const REDACT = new Set(['password', 'passwordHash', 'token', 'secret']);

function sanitize(body: unknown): Prisma.InputJsonValue | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    out[k] = REDACT.has(k) ? '[redacted]' : v;
  }
  return out as Prisma.InputJsonValue;
}
