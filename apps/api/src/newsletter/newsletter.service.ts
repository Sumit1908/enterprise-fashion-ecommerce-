import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import type { SubscribeDto } from './newsletter.dto.js';

const env = loadEnv();

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Deterministic token so an unsubscribe link needs no stored state. */
  token(email: string): string {
    return createHmac('sha256', env.COOKIE_SECRET)
      .update(`newsletter:${email.toLowerCase()}`)
      .digest('hex')
      .slice(0, 32);
  }

  private verifyToken(email: string, token: string): boolean {
    const expected = Buffer.from(this.token(email));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async subscribe(dto: SubscribeDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (existing && existing.status === 'subscribed') {
      return { ok: true, status: 'already-subscribed' as const };
    }

    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        firstName: dto.firstName ?? null,
        source: dto.source ?? 'unknown',
        status: 'subscribed',
        confirmedAt: new Date(),
      },
      update: {
        status: 'subscribed',
        unsubscribedAt: null,
        confirmedAt: new Date(),
        ...(dto.firstName ? { firstName: dto.firstName } : {}),
        ...(dto.source ? { source: dto.source } : {}),
      },
    });

    void this.sendWelcome(subscriber.email, subscriber.firstName).catch((e) =>
      this.logger.warn(`Welcome email skipped: ${(e as Error).message}`),
    );

    return { ok: true, status: existing ? ('resubscribed' as const) : ('subscribed' as const) };
  }

  async unsubscribe(email: string, token: string) {
    const normalized = email.trim().toLowerCase();
    if (!this.verifyToken(normalized, token)) {
      throw new BadRequestException('This unsubscribe link is invalid or has expired.');
    }
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email: normalized },
      data: { status: 'unsubscribed', unsubscribedAt: new Date() },
    });
    return { ok: true, status: 'unsubscribed' as const };
  }

  private async sendWelcome(email: string, firstName: string | null) {
    if (!this.email.configured) return;
    const unsubUrl = `${env.WEB_URL}/newsletter/unsubscribe?email=${encodeURIComponent(
      email,
    )}&token=${this.token(email)}`;
    const hi = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
    await this.email.send({
      to: email,
      subject: 'Welcome to the Slay Jeans list',
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#191512">
          <p style="letter-spacing:.2em;text-transform:uppercase;font-size:12px;color:#a5813f">Slay Jeans</p>
          <h1 style="font-size:26px;font-weight:500">You're on the list.</h1>
          <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#5f574e">
            ${hi} thanks for signing up. You'll be first to hear about new washes, restocks and
            limited runs &mdash; considered emails only, no noise.
          </p>
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#8c8377">
            Not you, or changed your mind? <a href="${unsubUrl}" style="color:#8c8377">Unsubscribe</a>.
          </p>
        </div>`,
    });
  }

  /* ------------------------------------------------------------------ admin */

  async adminList(params: { page?: number; pageSize?: number; status?: string; q?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
    const where = {
      ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
      ...(params.q ? { email: { contains: params.q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total, subscribed] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.count({ where: { status: 'subscribed' } }),
    ]);
    return { items, total, subscribed, page, pageSize };
  }

  async adminExportCsv(): Promise<string> {
    const rows = await this.prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' } });
    const header = 'email,status,source,firstName,createdAt,confirmedAt,unsubscribedAt';
    const body = rows
      .map((r) =>
        [
          r.email,
          r.status,
          r.source ?? '',
          r.firstName ?? '',
          r.createdAt.toISOString(),
          r.confirmedAt?.toISOString() ?? '',
          r.unsubscribedAt?.toISOString() ?? '',
        ]
          .map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
          .join(','),
      )
      .join('\n');
    return `${header}\n${body}\n`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
