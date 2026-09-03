import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ShiprocketService } from './shiprocket.service.js';
import { ShippingService } from './shipping.service.js';
import { ShippingAdminController } from './shipping.controller.js';
import { ShippingWebhookController } from './shipping-webhook.controller.js';

/**
 * Shiprocket courier integration. Self-contained: it reads orders straight from
 * Prisma, so it does not depend on OrdersModule (which keeps the OrdersModule →
 * ShippingModule hook dependency one-directional and cycle-free).
 */
@Module({
  imports: [AuthModule],
  controllers: [ShippingAdminController, ShippingWebhookController],
  providers: [ShiprocketService, ShippingService],
  exports: [ShippingService, ShiprocketService],
})
export class ShippingModule {}
