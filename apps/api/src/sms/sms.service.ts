import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '@slay/config';

const env = loadEnv();

export interface SendSmsResult {
  delivered: boolean;
  provider: string;
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
      return { delivered: false, provider: 'error', reason: (err as Error).message };
    }
    // No transport — log so the flow is still testable in development.
    if (env.NODE_ENV !== 'production') {
      this.logger.warn(`[DEV OTP] ${phoneE164} -> ${code}`);
    } else {
      this.logger.warn(`SMS not sent (no transport configured) -> ${mask(phoneE164)}`);
    }
    return { delivered: false, provider: 'none', reason: 'no sms transport configured' };
  }

  private async sendViaMsg91(phoneE164: string, code: string, fallbackText: string): Promise<SendSmsResult> {
    const mobile = phoneE164.replace(/^\+/, '');
    // MSG91 "OTP" flow when a template id is set; otherwise the plain SMS API.
    if (env.MSG91_OTP_TEMPLATE_ID) {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.searchParams.set('template_id', env.MSG91_OTP_TEMPLATE_ID);
      url.searchParams.set('mobile', mobile);
      url.searchParams.set('otp', code);
      if (env.MSG91_SENDER_ID) url.searchParams.set('sender', env.MSG91_SENDER_ID);
      const res = await fetch(url, {
        method: 'POST',
        headers: { authkey: env.MSG91_AUTH_KEY!, 'content-type': 'application/json' },
      });
      const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
      const ok = res.ok && body.type !== 'error';
      if (!ok) this.logger.warn(`MSG91 otp error: ${res.status} ${body.message ?? ''}`);
      return { delivered: ok, provider: 'msg91', reason: ok ? undefined : body.message };
    }
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: env.MSG91_AUTH_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: env.MSG91_SENDER_ID ?? 'VELORH',
        short_url: '0',
        mobiles: mobile,
        message: fallbackText,
      }),
    });
    const ok = res.ok;
    if (!ok) this.logger.warn(`MSG91 flow error: ${res.status} ${await res.text().catch(() => '')}`);
    return { delivered: ok, provider: 'msg91', reason: ok ? undefined : `http ${res.status}` };
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
    return { delivered: ok, provider: 'twilio', reason: ok ? undefined : `http ${res.status}` };
  }
}

function mask(phone: string): string {
  return phone.length > 4 ? phone.slice(0, 3) + '****' + phone.slice(-2) : '****';
}
