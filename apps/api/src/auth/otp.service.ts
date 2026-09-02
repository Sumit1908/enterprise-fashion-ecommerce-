import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from '../sms/sms.service.js';

const env = loadEnv();
const PEPPER = env.OTP_PEPPER ?? env.JWT_ACCESS_SECRET;

export interface OtpRequestResult {
  phone: string;
  expiresInSec: number;
  resendInSec: number;
  /** true only when no SMS transport is configured (dev) — lets QA continue */
  delivered: boolean;
  devCode?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /** Normalise a user-entered number to E.164, assuming India (+91) when bare. */
  normalisePhone(raw: string): string {
    const digits = (raw ?? '').replace(/[^\d+]/g, '');
    let e164 = digits;
    if (e164.startsWith('00')) e164 = '+' + e164.slice(2);
    if (!e164.startsWith('+')) {
      const local = e164.replace(/^0+/, '');
      e164 = local.length === 10 ? `+91${local}` : `+${local}`;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      throw new BadRequestException('Enter a valid mobile number');
    }
    // India: exactly 10 national digits, first digit 6-9.
    if (e164.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(e164)) {
      throw new BadRequestException('Enter a valid 10-digit Indian mobile number');
    }
    return e164;
  }

  private hash(phone: string, code: string): string {
    return createHmac('sha256', PEPPER).update(`${phone}:${code}`).digest('hex');
  }

  /** Create (or refresh) a challenge and send the code. Enforces resend cooldown. */
  async request(rawPhone: string, ip?: string, purpose = 'auth'): Promise<OtpRequestResult> {
    const phone = this.normalisePhone(rawPhone);
    const now = new Date();

    const existing = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const sinceLast = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
      const cooldown = env.OTP_RESEND_COOLDOWN_SEC;
      if (sinceLast < cooldown) {
        throw new HttpException(
          {
            message: `Please wait ${Math.ceil(cooldown - sinceLast)}s before requesting another code`,
            retryInSec: Math.ceil(cooldown - sinceLast),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (existing.resendCount >= env.OTP_MAX_RESENDS) {
        throw new HttpException(
          { message: 'Too many code requests. Please try again later.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Rate-limit distinct challenges per number over a rolling window.
    const recent = await this.prisma.otpChallenge.count({
      where: { phone, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
    if (recent >= 8) {
      throw new HttpException(
        { message: 'Too many attempts for this number. Please try again in an hour.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now.getTime() + env.OTP_TTL_SEC * 1000);

    if (existing) {
      await this.prisma.otpChallenge.update({
        where: { id: existing.id },
        data: {
          codeHash: this.hash(phone, code),
          attempts: 0,
          resendCount: { increment: 1 },
          lastSentAt: now,
          expiresAt,
        },
      });
    } else {
      await this.prisma.otpChallenge.create({
        data: {
          phone,
          codeHash: this.hash(phone, code),
          purpose,
          maxAttempts: env.OTP_MAX_ATTEMPTS,
          expiresAt,
          ip: ip?.slice(0, 45) ?? null,
        },
      });
    }

    const result = await this.sms.sendOtp(phone, code);
    return {
      phone,
      expiresInSec: env.OTP_TTL_SEC,
      resendInSec: env.OTP_RESEND_COOLDOWN_SEC,
      delivered: result.delivered,
      // Surface the code to the client ONLY outside production, and only when we
      // cannot be sure it was actually delivered — so local/QA testing works
      // when no SMS transport is set up, the provider rejects the send, or the
      // send path can't confirm delivery.
      devCode:
        env.NODE_ENV !== 'production' &&
        (!this.sms.configured || !result.delivered || !result.verified)
          ? code
          : undefined,
    };
  }

  /**
   * Verify a code. On success the challenge is consumed (single-use) and the
   * caller may treat the number as verified. Throws a 4xx with a clear message
   * otherwise.
   */
  async verify(rawPhone: string, code: string, purpose = 'auth'): Promise<{ phone: string }> {
    const phone = this.normalisePhone(rawPhone);
    if (!/^\d{4,8}$/.test(code ?? '')) {
      throw new BadRequestException('Enter the 6-digit code');
    }
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) {
      throw new BadRequestException('Request a new code');
    }
    if (challenge.expiresAt < new Date()) {
      throw new HttpException({ message: 'This code has expired. Request a new one.', code: 'expired' }, HttpStatus.GONE);
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new HttpException(
        { message: 'Too many incorrect attempts. Request a new code.', code: 'locked' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = Buffer.from(challenge.codeHash);
    const given = Buffer.from(this.hash(phone, code));
    const match = expected.length === given.length && timingSafeEqual(expected, given);

    if (!match) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts },
      });
      const left = challenge.maxAttempts - attempts;
      throw new BadRequestException(
        left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Incorrect code. Request a new one.',
      );
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    // Opportunistic cleanup of stale rows for this number.
    await this.prisma.otpChallenge
      .deleteMany({ where: { phone, OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: new Date() } }], id: { not: challenge.id } } })
      .catch(() => undefined);

    return { phone };
  }
}
