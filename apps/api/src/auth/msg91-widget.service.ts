import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { loadEnv } from '@slay/config';

const VERIFY_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';
const WIDGET_INFO_URL = 'https://control.msg91.com/api/v5/widget/getWidgetProcess';

export interface WidgetInfo {
  /** MSG91 widget is present + Enabled. */
  enabled: boolean;
  /** Number of digits in the OTP this widget issues (usually 4 or 6). */
  otpLength: number;
  /** Seconds before "Resend" is allowed. */
  retryTime: number;
}

/**
 * Server-side half of the MSG91 "Secure OTP" widget integration.
 *
 * The widget sends + verifies the OTP entirely in the browser (client-side
 * integration) and hands back a short-lived, single-use `access-token`. This
 * service validates that token against MSG91 with the account authkey — the
 * only secret involved — and returns the number MSG91 confirmed as verified.
 *
 * The deprecated MSG91 verification webhook is intentionally NOT used.
 */
@Injectable()
export class Msg91WidgetService {
  private readonly logger = new Logger(Msg91WidgetService.name);

  /** Reuses MSG91_AUTH_KEY — no separate credential. */
  private get authKey(): string | undefined {
    return loadEnv().MSG91_AUTH_KEY;
  }

  get configured(): boolean {
    return Boolean(this.authKey);
  }

  /**
   * Public (browser-safe) widget parameters, so the storefront can be configured
   * from the API alone. `widget` is true only when the server can also verify.
   */
  publicConfig(): { widget: boolean; widgetId: string | null; tokenAuth: string | null } {
    const env = loadEnv();
    const widgetId = env.MSG91_WIDGET_ID ?? null;
    const tokenAuth = env.MSG91_WIDGET_TOKEN_AUTH ?? null;
    return {
      widget: Boolean(this.authKey && widgetId && tokenAuth),
      widgetId,
      tokenAuth,
    };
  }

  private infoCache?: { at: number; value: WidgetInfo | null };

  /**
   * Ask MSG91 about the widget (Enabled?, OTP length, resend time). Cached ~10min.
   * Returns null if the widget isn't configured or MSG91 can't be reached.
   */
  async widgetInfo(): Promise<WidgetInfo | null> {
    const env = loadEnv();
    const widgetId = env.MSG91_WIDGET_ID;
    const tokenAuth = env.MSG91_WIDGET_TOKEN_AUTH;
    if (!widgetId || !tokenAuth) return null;

    if (this.infoCache && Date.now() - this.infoCache.at < 10 * 60 * 1000) {
      return this.infoCache.value;
    }

    let value: WidgetInfo | null = null;
    try {
      const res = await fetch(
        `${WIDGET_INFO_URL}?widgetId=${encodeURIComponent(widgetId)}`,
        {
          headers: { tokenauth: tokenAuth, accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: {
          otpLength?: number | string;
          retryTime?: number | string;
          status?: { value?: string | number };
        };
        hasError?: boolean;
      };
      const d = body.data;
      if (res.ok && !body.hasError && d) {
        value = {
          enabled: String(d.status?.value ?? '1') === '1',
          otpLength: clampInt(d.otpLength, 4, 4, 8),
          retryTime: clampInt(d.retryTime, 15, 5, 300),
        };
      } else {
        this.logger.warn(`MSG91 getWidgetProcess: ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
      }
    } catch (err) {
      this.logger.warn(`MSG91 getWidgetProcess failed: ${(err as Error).message}`);
    }

    this.infoCache = { at: Date.now(), value };
    return value;
  }

  async verifyAccessToken(accessToken: string): Promise<{ phone: string | null }> {
    const authkey = this.authKey;
    if (!authkey) {
      throw new ServiceUnavailableException(
        'OTP verification is not configured on the server',
      );
    }
    if (
      typeof accessToken !== 'string' ||
      accessToken.length < 10 ||
      accessToken.length > 8192
    ) {
      throw new BadRequestException('Missing or malformed verification token');
    }

    let res: Response;
    try {
      res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ authkey, 'access-token': accessToken }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      this.logger.error(
        `MSG91 verifyAccessToken network error: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Could not reach the OTP service. Please try again.',
      );
    }

    const body = (await res.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
    };
    const ok = res.ok && String(body.type ?? '').toLowerCase() === 'success';
    if (!ok) {
      this.logger.warn(
        `MSG91 rejected an OTP-widget token (${res.status}): ${body.message ?? 'no detail'}`,
      );
      throw new BadRequestException(
        'We could not confirm that verification. Please request a new OTP.',
      );
    }

    // On success MSG91 returns the verified mobile number in `message`.
    const digits = String(body.message ?? '').replace(/\D/g, '');
    const phone =
      digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
    return { phone };
  }
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
