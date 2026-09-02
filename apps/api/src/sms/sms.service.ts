import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@slay/config';

const env = loadEnv();

export interface SendSmsResult {
  /** The provider accepted the send request. */
  delivered: boolean;
  provider: string;
  /**
   * Whether `delivered` can be trusted. MSG91's transactional SMS API returns
   * "success" for any well-formed request (auth/DLT failures happen async), so
   * that path reports `verified: false` — callers may want to keep a dev code
   * visible outside production.
   */
  verified: boolean;
  reason?: string;
}

/**
 * Transactional SMS (OTP delivery). Resolves a transport from the environment:
 *   - SMS_PROVIDER=msg91  + MSG91_AUTH_KEY (+ MSG91_OTP_TEMPLATE_ID)  -> MSG91
 *   - SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM -> Twilio
 *   - nothing configured  -> logs the message, reports not delivered (dev only)
 *
 * Never throws — callers treat delivery as best-effort and the OTP challenge is
 * still created so QA can read the code from the API logs when unconfigured.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  get configured(): boolean {
    if (env.SMS_PROVIDER === 'twilio') {
      return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
    }
    return Boolean(env.MSG91_AUTH_KEY);
  }

  /** Send a one-time passcode to an E.164 phone number. */
  async sendOtp(phoneE164: string, code: string): Promise<SendSmsResult> {
    const message = `${code} is your Velor House verification code. It is valid for ${Math.round(
      env.OTP_TTL_SEC / 60,
    )} minutes. Do not share it with anyone.`;
    try {
      if (env.SMS_PROVIDER === 'twilio' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
        return await this.sendViaTwilio(phoneE164, message);
      }
      if (env.MSG91_AUTH_KEY) {
        return await this.sendViaMsg91(phoneE164, code, message);
      }
    } catch (err) {
      this.logger.error(`SMS delivery failed: ${(err as Error).message}`);
      return { delivered: false, verified: true, provider: 'error', reason: (err as Error).message };
    }
    // No transport — log so the flow is still testable in development.
    if (env.NODE_ENV !== 'production') {
      this.logger.warn(`[DEV OTP] ${phoneE164} -> ${code}`);
    } else {
      this.logger.warn(`SMS not sent (no transport configured) -> ${mask(phoneE164)}`);
    }
    return { delivered: false, verified: true, provider: 'none', reason: 'no sms transport configured' };
  }

  private async sendViaMsg91(phoneE164: string, code: string, fallbackText: string): Promise<SendSmsResult> {
    const mobile = phoneE164.replace(/^\+/, '');
    const authkey = env.MSG91_AUTH_KEY!;

    // Preferred: MSG91 "Send OTP" API with a registered OTP template.
    if (env.MSG91_OTP_TEMPLATE_ID) {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.searchParams.set('template_id', env.MSG91_OTP_TEMPLATE_ID);
      url.searchParams.set('mobile', mobile);
      url.searchParams.set('otp', code);
      if (env.MSG91_SENDER_ID) url.searchParams.set('sender', env.MSG91_SENDER_ID);
      const res = await fetch(url, {
        method: 'POST',
        headers: { authkey, 'content-type': 'application/json' },
      });
      const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string; request_id?: string };
      const ok = res.ok && String(body.type).toLowerCase() === 'success';
      if (!ok) this.logger.warn(`MSG91 otp error: ${res.status} ${body.message ?? ''}`);
      return { delivered: ok, verified: true, provider: 'msg91-otp', reason: ok ? undefined : body.message ?? `http ${res.status}` };
    }

    // No template id: fall back to the transactional SMS API (route 4). This
    // works with just the authkey + a registered sender; delivery in India still
    // depends on the account's DLT status.
    const res = await fetch('https://control.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: { authkey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: env.MSG91_SENDER_ID ?? 'VELORH',
        route: '4',
        country: '91',
        sms: [{ message: fallbackText, to: [mobile] }],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    const ok = res.ok && String(body.type).toLowerCase() === 'success';
    if (!ok) {
      this.logger.warn(
        `MSG91 sendsms error: ${res.status} ${body.message ?? ''} — set MSG91_OTP_TEMPLATE_ID for reliable OTP delivery`,
      );
    }
    // `verified: false` — MSG91 says "success" even for a bad authkey here.
    return { delivered: ok, verified: false, provider: 'msg91-sms', reason: ok ? undefined : body.message ?? `http ${res.status}` };
  }

  private async sendViaTwilio(phoneE164: string, message: string): Promise<SendSmsResult> {
    const sid = env.TWILIO_ACCOUNT_SID!;
    const from = env.TWILIO_FROM!;
    const params = new URLSearchParams({ To: phoneE164, Body: message });
    if (from.startsWith('MG')) params.set('MessagingServiceSid', from);
    else params.set('From', from);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const ok = res.ok;
    if (!ok) this.logger.warn(`Twilio error: ${res.status} ${await res.text().catch(() => '')}`);
    return { delivered: ok, verified: true, provider: 'twilio', reason: ok ? undefined : `http ${res.status}` };
  }
}

function mask(phone: string): string {
  return phone.length > 4 ? phone.slice(0, 3) + '****' + phone.slice(-2) : '****';
}
