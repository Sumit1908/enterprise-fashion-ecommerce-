import type { PaymentMethod } from '@slay/db';

export interface InitiateInput {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  amount: number; // major units, e.g. rupees
  currency: string;
  method: PaymentMethod;
  customer: { email?: string | null; phone?: string | null; name?: string | null };
}

export interface PaymentInitResult {
  provider: string; // 'cod' | 'mock' | 'razorpay'
  /** true => the client must complete a gateway step and then call /checkout/verify */
  requiresClientAction: boolean;
  status: 'pending' | 'paid';
  providerOrderId?: string;
  amount: number;
  currency: string;
  /** Non-secret data the browser SDK needs (e.g. Razorpay key id). */
  clientConfig?: Record<string, unknown>;
}

export interface VerifyInput {
  paymentId: string;
  orderNumber: string;
  amount: number;
  providerOrderId?: string;
  providerPaymentId?: string;
  signature?: string;
  /** Dev simulator only (mock provider): the outcome the tester chose. */
  mockOutcome?: 'success' | 'failure';
}

export interface VerifyResult {
  ok: boolean;
  providerPaymentId?: string;
  raw?: unknown;
  reason?: string;
}

export interface WebhookResult {
  ok: boolean;
  handled: boolean;
  event?: string;
  /** our Payment.id, recovered from the gateway payload notes/receipt */
  paymentId?: string;
  providerPaymentId?: string;
  outcome?: 'paid' | 'failed';
  raw?: unknown;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly methods: PaymentMethod[];
  isAvailable(): boolean;
  initiate(input: InitiateInput): Promise<PaymentInitResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookResult;
}
