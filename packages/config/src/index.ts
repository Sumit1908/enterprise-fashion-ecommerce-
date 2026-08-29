/**
 * Runtime environment validation. Import `loadEnv()` once at process start
 * (API bootstrap, worker, scripts). Fails fast with a readable error if a
 * required variable is missing or malformed.
 */
import { z } from 'zod';

const bool = z
  .string()
  .transform((v) => v === 'true' || v === '1')
  .pipe(z.boolean());

const optionalUrl = z.string().url().optional().or(z.literal('').transform(() => undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  WEB_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3001'),
  API_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  ELASTICSEARCH_NODE: z.string().url().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
  ELASTICSEARCH_PRODUCT_INDEX: z.string().default('products'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_SECRET: z.string().min(16).default('dev-cookie-secret-please-change'),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_BASE_URL: optionalUrl,

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PHONEPE_MERCHANT_ID: z.string().optional(),
  PHONEPE_SALT_KEY: z.string().optional(),
  PAYU_MERCHANT_KEY: z.string().optional(),
  PAYU_MERCHANT_SALT: z.string().optional(),

  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  DELHIVERY_API_TOKEN: z.string().optional(),
  BLUEDART_LICENSE_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['smtp', 'ses', 'resend']).default('smtp'),
  EMAIL_FROM: z.string().default('Slay Jeans <no-reply@slayjeans.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  SMS_PROVIDER: z.enum(['msg91', 'twilio']).default('msg91'),
  MSG91_AUTH_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  WHATSAPP_PROVIDER: z.enum(['meta', 'gupshup']).default('meta'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  FEATURE_VOICE_SEARCH: bool.default('true'),
  FEATURE_LOYALTY: bool.default('true'),
  FEATURE_BLOG: bool.default('true'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => loadEnv().NODE_ENV === 'production';
