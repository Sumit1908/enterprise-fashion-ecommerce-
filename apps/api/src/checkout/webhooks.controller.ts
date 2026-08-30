import { Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators.js';
import { OrdersService } from '../orders/orders.service.js';

/** Payment gateway webhooks. Signature-verified inside each provider. */
@ApiExcludeController()
@Public()
@Controller('webhooks/payments')
export class WebhooksController {
  constructor(private readonly orders: OrdersService) {}

  @Post(':provider')
  @HttpCode(200)
  handle(@Param('provider') provider: string, @Req() req: Request) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.orders.handleWebhook(provider, raw, req.headers);
  }
}
