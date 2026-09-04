import './bootstrap-env.js';
import 'reflect-metadata';
import { join } from 'node:path';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { loadEnv } from '@slay/config';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });

  // Serve locally-stored media when S3 is not configured.
  app.useStaticAssets(join(process.cwd(), env.MEDIA_UPLOAD_DIR), {
    prefix: '/uploads/',
    immutable: true,
    maxAge: '365d',
  });

  app.use(
    helmet({
      // Allow the storefront/admin origins to load locally-served /uploads media.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser(env.COOKIE_SECRET));

  // The courier/Shiprocket webhook must NEVER return 4xx/5xx — the provider's
  // "Test Webhook" reports failure on any non-2xx. Parse its body leniently (any
  // content-type, and a JSON syntax error becomes an empty body instead of a
  // 400). The raw body is still captured. This runs before the strict global
  // parser below; body-parser marks the request as parsed so the global one then
  // skips it. (Payments webhooks live under /webhooks/payments and are untouched.)
  app.use(
    ['/api/v1/webhooks/shipping', '/api/v1/webhooks/logistics'],
    (
      req: IncomingMessage & { rawBody?: Buffer; body?: unknown },
      res: import('node:http').ServerResponse,
      next: (err?: unknown) => void,
    ) => {
      const parser = json({
        limit: '2mb',
        type: () => true,
        verify: (r: IncomingMessage & { rawBody?: Buffer }, _s, buf: Buffer) => {
          r.rawBody = Buffer.from(buf);
        },
      }) as unknown as (
        r: IncomingMessage,
        s: import('node:http').ServerResponse,
        n: (err?: unknown) => void,
      ) => void;
      parser(req, res, (err?: unknown) => {
        if (err) req.body = {};
        next();
      });
    },
  );

  // Bulk CSV imports can be large. Keep the raw JSON body for webhook signature checks.
  app.use(
    json({
      limit: '25mb',
      verify: (req: IncomingMessage & { rawBody?: Buffer }, _res, buf: Buffer) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Velor House API')
    .setDescription('Storefront + admin + mobile API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // Hosts like Render/Railway inject PORT; fall back to the port in API_URL, then 4000.
  const port =
    Number(process.env.PORT) || Number(new URL(env.API_URL).port) || 4000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`API ready on ${env.API_URL}  (docs at ${env.API_URL}/api/docs)`);

  // Keep the instance warm on Render's free tier. Without this the service spins
  // down after ~15 min idle and a cold start takes 30-60s — long enough that an
  // inbound webhook validation (Shiprocket, Razorpay) times out on the caller's
  // side ("unable to send request to mentioned api"). A periodic self-request to
  // the public URL counts as inbound traffic and resets the idle timer.
  // Disable with KEEP_WARM=false (e.g. once on a paid always-on plan).
  if (env.NODE_ENV === 'production' && process.env.KEEP_WARM !== 'false') {
    const pingUrl = `${env.API_URL.replace(/\/$/, '')}/api/v1/health`;
    const everyMs = Math.max(60_000, Number(process.env.KEEP_WARM_INTERVAL_SEC || 600) * 1000);
    const timer = setInterval(() => {
      fetch(pingUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    }, everyMs);
    timer.unref?.();
  }
}

void bootstrap();
