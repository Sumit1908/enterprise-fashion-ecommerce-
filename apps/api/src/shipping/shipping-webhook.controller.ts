import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
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
 * Always returns 200 so Shiprocket does not enter a retry storm; the body says
 * whether the event was actually applied.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks/shipping')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(private readonly shipping: ShippingService) {}

  @Post('shiprocket')
  @HttpCode(200)
  async shiprocket(@Body() body: SrWebhookBody, @Req() req: Request) {
    if (!this.shipping.verifyWebhook(req.headers)) {
      this.logger.warn('Rejected Shiprocket webhook — missing/invalid x-api-key');
      return { received: true, handled: false, reason: 'unverified' };
    }
    try {
      const result = await this.shipping.handleWebhook(body ?? {});
      return { received: true, ...result };
    } catch (err) {
      this.logger.error(`Shiprocket webhook error: ${(err as Error).message}`);
      return { received: true, handled: false, reason: 'error' };
    }
  }
}
