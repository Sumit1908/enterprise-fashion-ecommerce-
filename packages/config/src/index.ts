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

/** Optional string that trims surrounding whitespace and treats "" as unset. */
const trimmedOptional = z
  .string()
  .transform((s) => s.trim())
  .transform((s) => (s.length ? s : undefined))
  .optional();

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
  // Optional: custom S3-compatible endpoint (e.g. MinIO, Cloudflare R2).
  S3_ENDPOINT: optionalUrl,
  S3_FORCE_PATH_STYLE: bool.default('false'),
  // Local disk fallback used when S3 is not configured (dev only).
  MEDIA_UPLOAD_DIR: z.string().default('uploads'),
  MEDIA_MAX_MB: z.coerce.number().default(15),
  // Product videos are opt-in (the schema supports them; storefront shows images).
  MEDIA_ALLOW_VIDEO: bool.default('false'),

  // Optional: AI product-attribute suggestions from a product image (Anthropic
  // Claude vision). No key -> the admin "Suggest with AI" button is hidden.
  ANTHROPIC_API_KEY: trimmedOptional,
  AI_SUGGEST_MODEL: z.string().default('claude-3-5-haiku-latest'),

  // Product search backend. 'postgres' works with no extra infra;
  // 'elasticsearch' requires a reachable ELASTICSEARCH_NODE.
  SEARCH_DRIVER: z.enum(['postgres', 'elasticsearch']).default('postgres'),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Fake gateway for local/CI testing. Auto-disabled in production regardless.
  PAYMENTS_MOCK_ENABLED: bool.optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PHONEPE_MERCHANT_ID: z.string().optional(),
  PHONEPE_SALT_KEY: z.string().optional(),
  PAYU_MERCHANT_KEY: z.string().optional(),
  PAYU_MERCHANT_SALT: z.string().optional(),

  // Shiprocket — courier aggregator. EMAIL/PASSWORD belong to a Shiprocket
  // "API user" (Settings -> API -> Configure). All other keys have safe defaults.
  SHIPROCKET_EMAIL: trimmedOptional,
  SHIPROCKET_PASSWORD: trimmedOptional,
  SHIPROCKET_BASE_URL: z.string().url().default('https://apiv2.shiprocket.in/v1/external'),
  // Nickname of a *verified* pickup location in the Shiprocket panel
  // (Settings -> Company -> Pickup Addresses). Required for order creation.
  SHIPROCKET_PICKUP_LOCATION: trimmedOptional,
  SHIPROCKET_CHANNEL_ID: trimmedOptional,
  // Shared secret configured on the Shiprocket webhook (sent as the `x-api-key`
  // header). The webhook is rejected unless it matches.
  SHIPROCKET_WEBHOOK_TOKEN: trimmedOptional,
  // Push a shipment to Shiprocket automatically when an order is confirmed.
  SHIPROCKET_AUTO_CREATE: bool.default('true'),
  // Automatically assign an AWB (recommended courier) right after order creation.
  SHIPROCKET_AUTO_ASSIGN_AWB: bool.default('true'),
  // Fallback parcel dimensions/weight when a product has no weight set.
  SHIPROCKET_DEFAULT_WEIGHT_KG: z.coerce.number().positive().default(0.5),
  SHIPROCKET_DEFAULT_LENGTH_CM: z.coerce.number().positive().default(25),
  SHIPROCKET_DEFAULT_BREADTH_CM: z.coerce.number().positive().default(20),
  SHIPROCKET_DEFAULT_HEIGHT_CM: z.coerce.number().positive().default(5),

  DELHIVERY_API_TOKEN: z.string().optional(),
  BLUEDART_LICENSE_KEY: z.string().optional(),

  // Checkout PIN-code validation (city/state auto-fill + serviceability).
  // api.postalpincode.in is a keyless India Post wrapper — no secret needed.
  PINCODE_PROVIDER: z.enum(['indiapost', 'none']).default('indiapost'),
  PINCODE_API_BASE_URL: z.string().url().default('https://api.postalpincode.in'),
  PINCODE_LOOKUP_TIMEOUT_MS: z.coerce.number().default(4000),
  PINCODE_CACHE_TTL_DAYS: z.coerce.number().default(90),

  EMAIL_PROVIDER: z.enum(['smtp', 'ses', 'resend']).default('smtp'),
  EMAIL_FROM: z.string().default('Velor House <velorhouse@gmail.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  SMS_PROVIDER: z.enum(['msg91', 'twilio']).default('msg91'),
  // trimmedOptional guards against a stray space/newline pasted into a dashboard field.
  MSG91_AUTH_KEY: trimmedOptional, // secret — also verifies MSG91 OTP-widget tokens
  MSG91_SENDER_ID: trimmedOptional, // 6-char DLT sender, e.g. VELORH
  MSG91_OTP_TEMPLATE_ID: trimmedOptional, // MSG91 "OTP" flow / OTP template id
  // MSG91 Secure OTP widget. The widget id + token auth are PUBLIC (they ship to
  // the browser); setting them here lets the storefront pick them up at runtime
  // via GET /auth/otp/config — no web rebuild needed. The authkey above (secret)
  // validates the access token the widget returns.
  MSG91_WIDGET_ID: trimmedOptional,
  MSG91_WIDGET_TOKEN_AUTH: trimmedOptional,
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(), // a Twilio phone number OR Messaging Service SID (MG…)
  // Extra secret mixed into the OTP hash. Falls back to JWT_ACCESS_SECRET.
  OTP_PEPPER: z.string().optional(),
  OTP_TTL_SEC: z.coerce.number().default(300), // code validity
  OTP_RESEND_COOLDOWN_SEC: z.coerce.number().default(30),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_MAX_RESENDS: z.coerce.number().default(4),

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
