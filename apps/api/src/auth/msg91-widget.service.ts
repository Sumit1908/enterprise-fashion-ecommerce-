import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { loadEnv } from '@slay/config';

const VERIFY_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

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
