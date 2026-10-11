import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits per visitor instead of per proxy. On Render every request reaches
 * the app through Cloudflare + Render's load balancer, so `req.ip` is the proxy's
 * address and all visitors would share one bucket (e.g. 15 OTP verifications per
 * minute for the whole site). Cloudflare sets `CF-Connecting-IP` to the real
 * client address and overwrites any client-supplied value; fall back to `req.ip`
 * when it is absent (local dev, Docker).
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const cf = req.headers?.['cf-connecting-ip'];
    return (typeof cf === 'string' && cf.trim()) || req.ip;
  }
}
