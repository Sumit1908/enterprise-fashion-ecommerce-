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
}

void bootstrap();
