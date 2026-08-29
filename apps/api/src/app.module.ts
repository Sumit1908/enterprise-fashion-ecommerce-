import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from '@slay/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { StorefrontModule } from './storefront/storefront.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HealthModule } from './health/health.module.js';

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
    HealthModule,
    AuthModule,
    CatalogModule,
    StorefrontModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
