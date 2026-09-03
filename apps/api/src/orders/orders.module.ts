import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import { CheckoutController } from '../checkout/checkout.controller.js';
import { WebhooksController } from '../checkout/webhooks.controller.js';
import { ShippingModule } from '../shipping/shipping.module.js';

@Global()
@Module({
  imports: [AuthModule, ShippingModule],
  controllers: [OrdersController, CheckoutController, WebhooksController],
  providers: [OrdersService, CheckoutService],
  exports: [OrdersService],
})
export class OrdersModule {}
