import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from '@slay/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { StorefrontModule } from './storefront/storefront.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { SearchModule } from './search/search.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { CartModule } from './cart/cart.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { EmailModule } from './email/email.module.js';
import { SmsModule } from './sms/sms.module.js';
import { NewsletterModule } from './newsletter/newsletter.module.js';
import { WishlistModule } from './wishlist/wishlist.module.js';

const env = loadEnv();

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: env.RATE_LIMIT_WINDOW_SEC * 1000,
        limit: env.RATE_LIMIT_MAX,
      },
    ]),
    PrismaModule,
    CommonModule,
    EmailModule,
    SmsModule,
    HealthModule,
    AuthModule,
    MediaModule,
    SearchModule,
    PricingModule,
    PaymentsModule,
    CartModule,
    OrdersModule,
    CatalogModule,
    StorefrontModule,
    AdminModule,
    NewsletterModule,
    WishlistModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
