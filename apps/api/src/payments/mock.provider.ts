import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
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

/**
 * A fake online-payment gateway for local development and CI. Lets the entire
 * cart -> checkout -> pay -> order flow be tested without any real credentials.
 * Never active in production.
 */
@Injectable()
export class MockProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly methods: PaymentMethod[] = ['CARD', 'UPI', 'NETBANKING', 'RAZORPAY'];

  isAvailable(): boolean {
    if (env.NODE_ENV === 'production') return false;
    return env.PAYMENTS_MOCK_ENABLED !== false;
  }

  async initiate(input: InitiateInput): Promise<PaymentInitResult> {
    return {
      provider: this.id,
      requiresClientAction: true,
      status: 'pending',
      providerOrderId: `mock_order_${input.paymentId}`,
      amount: input.amount,
      currency: input.currency,
      clientConfig: {
        // The storefront sends the shopper here to simulate the gateway page.
        payUrl: `/checkout/pay/${input.orderNumber}`,
        sandbox: true,
      },
    };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    if (input.mockOutcome === 'failure') {
      return { ok: false, reason: 'Payment declined (simulated)' };
    }
    return {
      ok: true,
      providerPaymentId: input.providerPaymentId ?? `mock_pay_${randomBytes(8).toString('hex')}`,
      raw: { simulated: true },
    };
  }

  verifyWebhook(): WebhookResult {
    return { ok: true, handled: false };
  }
}
