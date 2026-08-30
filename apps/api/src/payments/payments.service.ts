import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { CodProvider } from './cod.provider.js';
import { MockProvider } from './mock.provider.js';
import { RazorpayProvider } from './razorpay.provider.js';

const env = loadEnv();

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly cod: CodProvider,
    private readonly mock: MockProvider,
    private readonly razorpay: RazorpayProvider,
  ) {}

  /** Providers in priority order (first available one wins for a given method). */
  private get providers(): PaymentProvider[] {
    return [this.cod, this.razorpay, this.mock];
  }

  private availableProviders(): PaymentProvider[] {
    return this.providers.filter((p) => p.isAvailable());
  }

  /** PaymentMethod values the storefront may offer right now. */
  enabledMethods(configuredMethods: string[]): PaymentMethod[] {
    const supported = new Set<PaymentMethod>();
    for (const provider of this.availableProviders()) {
      for (const m of provider.methods) supported.add(m);
    }
    return configuredMethods.filter((m): m is PaymentMethod =>
      supported.has(m as PaymentMethod),
    );
  }

  providerFor(method: PaymentMethod): PaymentProvider {
    const provider = this.availableProviders().find((p) => p.methods.includes(method));
    if (!provider) {
      throw new BadRequestException(`Payment method ${method} is not available`);
    }
    return provider;
  }

  providerById(id: string): PaymentProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  initiate(method: PaymentMethod, input: InitiateInput): Promise<PaymentInitResult> {
    return this.providerFor(method).initiate(input);
  }

  verify(providerId: string, input: VerifyInput): Promise<VerifyResult> {
    const provider = this.providerById(providerId);
    if (!provider) return Promise.resolve({ ok: false, reason: 'Unknown payment provider' });
    return provider.verify(input);
  }

  verifyWebhook(
    providerId: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookResult {
    const provider = this.providerById(providerId);
    if (!provider) return { ok: false, handled: false, reason: 'Unknown provider' };
    return provider.verifyWebhook(rawBody, headers);
  }

  status() {
    return {
      environment: env.NODE_ENV,
      providers: this.providers.map((p) => ({
        id: p.id,
        available: p.isAvailable(),
        methods: p.methods,
      })),
    };
  }
}
