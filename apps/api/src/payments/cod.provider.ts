import { Injectable } from '@nestjs/common';
import type { PaymentMethod } from '@slay/db';
import type {
  InitiateInput,
  PaymentInitResult,
  PaymentProvider,
  VerifyInput,
  VerifyResult,
  WebhookResult,
} from './payment-provider.js';

/** Cash on Delivery — the order is confirmed immediately, payment collected later. */
@Injectable()
export class CodProvider implements PaymentProvider {
  readonly id = 'cod';
  readonly methods: PaymentMethod[] = ['COD'];

  isAvailable(): boolean {
    return true;
  }

  async initiate(input: InitiateInput): Promise<PaymentInitResult> {
    return {
      provider: this.id,
      requiresClientAction: false,
      status: 'pending', // paymentStatus stays PENDING; order is CONFIRMED by OrdersService
      amount: input.amount,
      currency: input.currency,
    };
  }

  async verify(_input: VerifyInput): Promise<VerifyResult> {
    return { ok: true };
  }

  verifyWebhook(): WebhookResult {
    return { ok: true, handled: false };
  }
}
