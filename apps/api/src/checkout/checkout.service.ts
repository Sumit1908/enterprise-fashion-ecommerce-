import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CartService, type CartContext } from '../cart/cart.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { money } from '../common/money.js';

const METHOD_LABELS: Record<string, { label: string; description: string }> = {
  COD: { label: 'Cash on Delivery', description: 'Pay in cash when your order arrives' },
  CARD: { label: 'Credit / Debit Card', description: 'Visa, Mastercard, RuPay, Amex' },
  UPI: { label: 'UPI', description: 'Google Pay, PhonePe, Paytm & more' },
  NETBANKING: { label: 'Net Banking', description: 'All major banks' },
  RAZORPAY: { label: 'Card / UPI / Net Banking', description: 'Secure payment via Razorpay' },
  WALLET: { label: 'Store Wallet', description: 'Use your Slay Jeans balance' },
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
  ) {}

  async summary(ctx: CartContext, pincode?: string) {
    const [cartView, shippingOptions, settings] = await Promise.all([
      this.cart.view(ctx),
      this.pricing.shippingOptions(pincode),
      this.pricing.storeSettings(),
    ]);

    const methods = this.payments.enabledMethods(settings.enabledMethods).map((m) => ({
      method: m,
      label: METHOD_LABELS[m]?.label ?? m,
      description: METHOD_LABELS[m]?.description ?? '',
      codAvailable: m !== 'COD' || shippingOptions.some((s) => s.codAvailable),
    }));

    let serviceability: { pincode: string; serviceable: boolean; etaMinDays?: number | null; etaMaxDays?: number | null; codAvailable: boolean } | null = null;
    if (pincode) {
      const svc = await this.prisma.serviceablePincode.findUnique({ where: { pincode } });
      serviceability = {
        pincode,
        serviceable: svc ? svc.prepaidAvailable : true,
        etaMinDays: svc?.etaMinDays,
        etaMaxDays: svc?.etaMaxDays,
        codAvailable: svc ? svc.codAvailable : true,
      };
    }

    return {
      cart: cartView,
      guestCheckoutEnabled: settings.guestCheckoutEnabled,
      minOrderAmount: settings.minOrderAmount,
      shippingOptions: shippingOptions.map((s) => ({
        ...s,
        price: money(s.price),
        codFee: money(s.codFee),
        freeAboveAmount: s.freeAboveAmount == null ? null : money(s.freeAboveAmount),
      })),
      paymentMethods: methods,
      serviceability,
    };
  }

  async quote(
    ctx: CartContext,
    input: { pincode?: string; shippingRateId?: string; couponCode?: string; paymentMethod?: string },
  ) {
    const resolved = await this.cart.resolveCart(ctx);
    const lines = resolved ? await this.cart.rawItems(resolved.id) : [];
    const shippingOptions = await this.pricing.shippingOptions(input.pincode);
    const shipping =
      shippingOptions.find((s) => s.id === input.shippingRateId) ?? shippingOptions[0] ?? null;

    const totals = await this.pricing.computeTotals({
      lines: lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({ unitPrice: l.unitPrice, quantity: Math.min(l.quantity, l.availableStock), taxRatePct: l.taxRatePct })),
      shipping,
      couponCode: input.couponCode ?? null,
      paymentMethod: input.paymentMethod ?? null,
      userId: ctx.userId,
    });

    return {
      shippingRateId: shipping?.id ?? null,
      totals: {
        currency: totals.currency,
        itemsSubtotal: money(totals.itemsSubtotal),
        discountTotal: money(totals.discountTotal),
        shippingTotal: money(totals.shippingTotal),
        taxTotal: money(totals.taxTotal),
        grandTotal: money(totals.grandTotal),
      },
      coupon: totals.coupon,
      amountToFreeShipping: money(totals.amountToFreeShipping),
    };
  }
}
