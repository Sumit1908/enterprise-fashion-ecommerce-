import { All, Controller, HttpCode, Logger, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators.js';
import { ShippingService } from './shipping.service.js';
import type { SrWebhookBody } from './shiprocket.types.js';

/**
 * Shiprocket tracking webhook.
 *
 * IMPORTANT — Shiprocket's webhook validator REFUSES any URL containing the
 * keywords "shiprocket", "kartrocket", "sr" or "kr" (it shows "unable to send
 * request to mentioned api"). So the canonical path is keyword-free:
 *
 *   https://slay-jeans-api.onrender.com/api/v1/webhooks/shipping/courier
 *   (aliases: /api/v1/webhooks/logistics , and the legacy
 *    /api/v1/webhooks/shipping/shiprocket which Shiprocket will reject but which
 *    the internal keep-warm ping / older docs may still hit)
 *
 * Auth: Shiprocket sends the configured token in whichever header the panel's
 * "Auth Token Type" selects — usually `Authorization` (raw value, sometimes
 * `Bearer <token>`) or `x-api-key`. `ShippingService.verifyWebhook` accepts all
 * of them.
 *
 * Hard rules: EVERY request (any method, any body, token or not) → HTTP 200 with
 * a small fixed body. Shiprocket disables a webhook that ever returns non-2xx.
 * Every hit is recorded (metadata only, never secret values).
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(private readonly shipping: ShippingService) {}

  @All(['shipping/courier', 'logistics', 'shipping/shiprocket'])
  @HttpCode(200)
  async courierWebhook(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const method = req.method.toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? {} : normaliseBody(req);

    void this.shipping.recordWebhookProbe(
      req,
      method === 'GET' || method === 'HEAD' ? undefined : (body as Record<string, unknown>),
      req.originalUrl,
    );

    res.setHeader('Cache-Control', 'no-store');

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return { ok: true, endpoint: 'courier-webhook' };
    }

    if (!this.shipping.verifyWebhook(req.headers)) {
      this.logger.warn(
        `Courier webhook: unverified (${describeAuth(req.headers)}) — set SHIPROCKET_WEBHOOK_TOKEN and match it in the Shiprocket panel`,
      );
      return { received: true, handled: false, reason: 'unverified' };
    }

    try {
      const result = await this.shipping.handleWebhook(body);
      return { received: true, ...result };
    } catch (err) {
      this.logger.error(`Courier webhook processing error: ${(err as Error).message}`);
      return { received: true, handled: false, reason: 'error' };
    }
  }
}

/* -------------------------------------------------------------------------- */

/** Parse whatever the courier sent into an object, tolerating junk. */
function normaliseBody(req: Request): SrWebhookBody {
  const b = (req as Request & { body?: unknown }).body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b) && !Array.isArray(b)) {
    return b as SrWebhookBody;
  }
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (raw && raw.length) {
    try {
      const parsed = JSON.parse(raw.toString('utf8')) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as SrWebhookBody;
      }
    } catch {
      /* not JSON — ignore */
    }
  }
  return {};
}

/** Non-sensitive description of the auth-header situation, for logs. */
function describeAuth(h: Record<string, string | string[] | undefined>): string {
  const has = (n: string) => (h[n] ?? h[n.toLowerCase()]) != null;
  const present = ['authorization', 'x-api-key', 'x-shiprocket-key', 'token', 'apikey'].filter(has);
  return present.length ? `auth header(s) present: ${present.join(', ')}` : 'no auth header on request';
}
