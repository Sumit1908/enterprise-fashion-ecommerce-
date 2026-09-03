import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ShiprocketError,
  type SrAwbResponse,
  type SrCancelResponse,
  type SrCreateOrderPayload,
  type SrCreateOrderResponse,
  type SrInvoiceResponse,
  type SrLabelResponse,
  type SrLoginResponse,
  type SrManifestResponse,
  type SrPickupListResponse,
  type SrPickupResponse,
  type SrServiceabilityResponse,
  type SrTrackingResponse,
} from './shiprocket.types.js';

const env = loadEnv();

/** Shiprocket tokens are valid ~240h; refresh a little early. */
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Low-level, type-safe client for the Shiprocket External API.
 *
 * - Authenticates with the API-user email/password, caches the bearer token in
 *   memory *and* the `Integration` table (survives restarts / shared instances).
 * - Retries transient failures (429 / 5xx / network) with backoff.
 * - Transparently re-authenticates once on a 401.
 * - Never logs credentials or tokens.
 */
@Injectable()
export class ShiprocketService {
  private readonly logger = new Logger(ShiprocketService.name);
  private cached: CachedToken | null = null;
  private inFlightLogin: Promise<string> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get configured(): boolean {
    return Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Shiprocket is not configured (set SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD).',
      );
    }
  }

  /* ----------------------------------------------------------------- auth */

  private async loadStoredToken(): Promise<CachedToken | null> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached;
    try {
      const row = await this.prisma.integration.findUnique({ where: { provider: 'shiprocket' } });
      const creds = (row?.credentials ?? null) as { token?: string; expiresAt?: number } | null;
      if (creds?.token && typeof creds.expiresAt === 'number' && creds.expiresAt > Date.now()) {
        this.cached = { token: creds.token, expiresAt: creds.expiresAt };
        return this.cached;
      }
    } catch (err) {
      this.logger.warn(`Could not read cached Shiprocket token: ${(err as Error).message}`);
    }
    return null;
  }

  private async persistToken(token: string): Promise<void> {
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    this.cached = { token, expiresAt };
    try {
      await this.prisma.integration.upsert({
        where: { provider: 'shiprocket' },
        create: {
          provider: 'shiprocket',
          category: 'shipping',
          isEnabled: true,
          isTestMode: false,
          status: 'ok',
          lastCheckedAt: new Date(),
          credentials: { token, expiresAt },
        },
        update: {
          isEnabled: true,
          status: 'ok',
          lastCheckedAt: new Date(),
          credentials: { token, expiresAt },
        },
      });
    } catch (err) {
      this.logger.warn(`Could not persist Shiprocket token: ${(err as Error).message}`);
    }
  }

  /** Force a fresh login (used on 401 and by the health check). */
  async login(): Promise<string> {
    this.assertConfigured();
    if (this.inFlightLogin) return this.inFlightLogin;

    this.inFlightLogin = (async () => {
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(`${env.SHIPROCKET_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            email: env.SHIPROCKET_EMAIL,
            password: env.SHIPROCKET_PASSWORD,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new ShiprocketError(
          `Shiprocket auth network error: ${(err as Error).message}`,
        );
      }
      const body = (await res.json().catch(() => ({}))) as SrLoginResponse & { message?: string };
      if (!res.ok || !body.token) {
        this.logger.error(`Shiprocket auth failed: ${res.status} ${body.message ?? ''}`);
        throw new ShiprocketError(
          body.message ?? `Shiprocket authentication failed (${res.status})`,
          res.status,
        );
      }
      await this.persistToken(body.token);
      this.logger.log(
        `Shiprocket authenticated as ${body.email ?? env.SHIPROCKET_EMAIL} (company ${body.company_id ?? '?'}) in ${Date.now() - started}ms`,
      );
      return body.token;
    })();

    try {
      return await this.inFlightLogin;
    } finally {
      this.inFlightLogin = null;
    }
  }

  private async token(): Promise<string> {
    const stored = await this.loadStoredToken();
    if (stored) return stored.token;
    return this.login();
  }

  /* -------------------------------------------------------------- request */

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    this.assertConfigured();
    const url = new URL(`${env.SHIPROCKET_BASE_URL}${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }

    let attempt = 0;
    let reauthed = false;
    for (;;) {
      attempt += 1;
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            authorization: `Bearer ${await this.token()}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        if (attempt <= MAX_RETRIES) {
          await sleep(backoff(attempt));
          continue;
        }
        throw new ShiprocketError(
          `Shiprocket ${method} ${path} network error: ${(err as Error).message}`,
        );
      }

      const text = await res.text();
      const parsed = text ? safeJson(text) : null;
      const ms = Date.now() - started;

      if (res.status === 401 && !reauthed) {
        this.logger.warn(`Shiprocket ${method} ${path} → 401; re-authenticating`);
        this.cached = null;
        await this.login();
        reauthed = true;
        continue;
      }

      if ((res.status === 429 || res.status >= 500) && attempt <= MAX_RETRIES) {
        this.logger.warn(
          `Shiprocket ${method} ${path} → ${res.status} (attempt ${attempt}/${MAX_RETRIES}), retrying`,
        );
        await sleep(backoff(attempt));
        continue;
      }

      if (!res.ok) {
        const message =
          (parsed as { message?: string })?.message ??
          extractErrors(parsed) ??
          `Shiprocket ${method} ${path} failed (${res.status})`;
        this.logger.error(`Shiprocket ${method} ${path} → ${res.status} ${ms}ms: ${message}`);
        throw new ShiprocketError(message, res.status, parsed);
      }

      this.logger.log(`Shiprocket ${method} ${path} → ${res.status} ${ms}ms`);
      return (parsed ?? {}) as T;
    }
  }

  /* --------------------------------------------------------- API methods */

  ping(): Promise<string> {
    return this.login();
  }

  listPickupLocations(): Promise<SrPickupListResponse> {
    return this.request<SrPickupListResponse>('GET', '/settings/company/pickup');
  }

  checkServiceability(input: {
    pickupPincode: string;
    deliveryPincode: string;
    weightKg: number;
    cod: boolean;
    declaredValue?: number;
  }): Promise<SrServiceabilityResponse> {
    return this.request<SrServiceabilityResponse>('GET', '/courier/serviceability/', {
      query: {
        pickup_postcode: input.pickupPincode,
        delivery_postcode: input.deliveryPincode,
        weight: input.weightKg,
        cod: input.cod ? 1 : 0,
        declared_value: input.declaredValue,
      },
    });
  }

  createOrder(payload: SrCreateOrderPayload): Promise<SrCreateOrderResponse> {
    return this.request<SrCreateOrderResponse>('POST', '/orders/create/adhoc', { body: payload });
  }

  assignAwb(shipmentId: number, courierId?: number): Promise<SrAwbResponse> {
    return this.request<SrAwbResponse>('POST', '/courier/assign/awb', {
      body: { shipment_id: shipmentId, ...(courierId ? { courier_id: courierId } : {}) },
    });
  }

  generatePickup(shipmentId: number): Promise<SrPickupResponse> {
    return this.request<SrPickupResponse>('POST', '/courier/generate/pickup', {
      body: { shipment_id: [shipmentId] },
    });
  }

  generateLabel(shipmentId: number): Promise<SrLabelResponse> {
    return this.request<SrLabelResponse>('POST', '/courier/generate/label', {
      body: { shipment_id: [shipmentId] },
    });
  }

  generateManifest(shipmentId: number): Promise<SrManifestResponse> {
    return this.request<SrManifestResponse>('POST', '/manifests/generate', {
      body: { shipment_id: [shipmentId] },
    });
  }

  printInvoice(orderId: number): Promise<SrInvoiceResponse> {
    return this.request<SrInvoiceResponse>('POST', '/orders/print/invoice', {
      body: { ids: [orderId] },
    });
  }

  trackByShipment(shipmentId: number): Promise<SrTrackingResponse> {
    return this.request<SrTrackingResponse>('GET', `/courier/track/shipment/${shipmentId}`);
  }

  trackByAwb(awb: string): Promise<SrTrackingResponse> {
    return this.request<SrTrackingResponse>('GET', `/courier/track/awb/${encodeURIComponent(awb)}`);
  }

  cancelOrder(orderId: number): Promise<SrCancelResponse> {
    return this.request<SrCancelResponse>('POST', '/orders/cancel', { body: { ids: [orderId] } });
  }

  cancelShipmentAwb(awb: string): Promise<SrCancelResponse> {
    return this.request<SrCancelResponse>('POST', '/orders/cancel/shipment/awbs', {
      body: { awbs: [awb] },
    });
  }
}

/* -------------------------------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function backoff(attempt: number): number {
  return Math.min(8000, 400 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 200);
}
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}
function extractErrors(parsed: unknown): string | undefined {
  const e = (parsed as { errors?: unknown })?.errors;
  if (!e) return undefined;
  if (Array.isArray(e)) return e.join('; ');
  if (typeof e === 'object') {
    return Object.entries(e as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('; ');
  }
  return String(e);
}
