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
 * Configure in the Shiprocket panel: Settings → API → Webhooks →
 *   URL:  https://slay-jeans-api.onrender.com/api/v1/webhooks/shipping/shiprocket
 *   Token / x-api-key:  the value of SHIPROCKET_WEBHOOK_TOKEN
 *
 * Hard rules for this endpoint (a webhook consumer must be maximally lenient):
 *  - EVERY request — GET, HEAD, POST, any body, any content-type, valid or
 *    invalid JSON, token or no token — gets HTTP 200 with a small fixed body.
 *    Shiprocket's "Test Webhook" reports "unable to send request to mentioned
 *    api" on *any* non-2xx or timeout, so this never returns 4xx/5xx.
 *  - Every hit is recorded (metadata only, never secret values) so we can tell
 *    whether Shiprocket's request actually reaches the server.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks/shipping')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(private readonly shipping: ShippingService) {}

  @All('shiprocket')
  @HttpCode(200)
  async shiprocket(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const method = req.method.toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? {} : normaliseBody(req);

    void this.shipping.recordWebhookProbe(
      req,
      method === 'GET' || method === 'HEAD' ? undefined : (body as Record<string, unknown>),
    );

    // Explicit fixed-length response so strict HTTP clients don't choke on
    // chunked transfer encoding.
    res.setHeader('Cache-Control', 'no-store');

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return { ok: true, endpoint: 'shiprocket-webhook' };
    }

    if (!this.shipping.verifyWebhook(req.headers)) {
      this.logger.warn(
        `Shiprocket webhook: unverified (${describeAuth(req.headers)}) — set SHIPROCKET_WEBHOOK_TOKEN and match it in the Shiprocket panel`,
      );
      return { received: true, handled: false, reason: 'unverified' };
    }

    try {
      const result = await this.shipping.handleWebhook(body);
      return { received: true, ...result };
    } catch (err) {
      this.logger.error(`Shiprocket webhook processing error: ${(err as Error).message}`);
      return { received: true, handled: false, reason: 'error' };
    }
  }
}

/* -------------------------------------------------------------------------- */

/** Parse whatever Shiprocket sent into an object, tolerating junk. */
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
  const present = ['x-api-key', 'x-shiprocket-key', 'authorization', 'token', 'apikey'].filter(has);
  return present.length ? `auth header(s) present: ${present.join(', ')}` : 'no auth header on request';
}
