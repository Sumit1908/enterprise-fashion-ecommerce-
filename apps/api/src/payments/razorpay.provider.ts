import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { PaymentMethod } from '@slay/db';
import { loadEnv } from '@slay/config';
import type {
  InitiateInput,
  PaymentInitResult,
  PaymentProvider,
  VerifyInput,
  VerifyResult,
  WebhookResult,
} from './payment-provider.js';

const env = loadEnv();

/** Razorpay standard checkout (India). Activates when RAZORPAY_KEY_* are set. */
@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly id = 'razorpay';
  readonly methods: PaymentMethod[] = ['RAZORPAY', 'CARD', 'UPI', 'NETBANKING'];
  private readonly logger = new Logger(RazorpayProvider.name);

  isAvailable(): boolean {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  }

  async initiate(input: InitiateInput): Promise<PaymentInitResult> {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.paymentId,
        notes: { paymentId: input.paymentId, orderNumber: input.orderNumber },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Razorpay order create failed: ${res.status} ${text}`);
      throw new Error('Could not start the payment. Please try again.');
    }
    const order = (await res.json()) as { id: string };
    return {
      provider: this.id,
      requiresClientAction: true,
      status: 'pending',
      providerOrderId: order.id,
      amount: input.amount,
      currency: input.currency,
      clientConfig: {
        keyId: env.RAZORPAY_KEY_ID,
        name: 'Velor House',
        prefill: { email: input.customer.email, contact: input.customer.phone, name: input.customer.name },
      },
    };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    if (!input.providerOrderId || !input.providerPaymentId || !input.signature) {
      return { ok: false, reason: 'Missing Razorpay verification fields' };
    }
    const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest('hex');
    if (!safeEqual(expected, input.signature)) {
      return { ok: false, reason: 'Signature mismatch' };
    }
    return { ok: true, providerPaymentId: input.providerPaymentId };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookResult {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    const sig = header(headers, 'x-razorpay-signature');
    if (!secret || !sig) return { ok: false, handled: false, reason: 'Webhook not configured' };

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeEqual(expected, sig)) return { ok: false, handled: false, reason: 'Bad signature' };

    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookBody;
    } catch {
      return { ok: false, handled: false, reason: 'Invalid JSON' };
    }

    const entity = body.payload?.payment?.entity;
    const paymentId = entity?.notes?.paymentId;
    if (!entity || !paymentId) return { ok: true, handled: false, event: body.event };

    const outcome: 'paid' | 'failed' | undefined =
      body.event === 'payment.captured' || body.event === 'order.paid'
        ? 'paid'
        : body.event === 'payment.failed'
          ? 'failed'
          : undefined;

    return {
      ok: true,
      handled: Boolean(outcome),
      event: body.event,
      paymentId,
      providerPaymentId: entity.id,
      outcome,
      raw: body,
    };
  }
}

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: {
      entity?: { id: string; order_id: string; notes?: { paymentId?: string } };
    };
  };
}

function header(h: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = h[name] ?? h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
