import { Injectable } from '@nestjs/common';
import { Prisma } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { round2, toNumber } from '../common/money.js';

export interface PriceLine {
  unitPrice: number;
  quantity: number;
  taxRatePct: number;
}

export interface ShippingChoice {
  id: string;
  name: string;
  price: number;
  codFee: number;
  freeAboveAmount: number | null;
  codAvailable: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
}

export interface Totals {
  currency: string;
  itemsSubtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  coupon: { code: string; description: string | null; discount: number } | null;
  freeShippingThreshold: number | null;
  amountToFreeShipping: number;
}

interface StoreSettings {
  currency: string;
  freeShippingThreshold: number | null;
  codEnabled: boolean;
  guestCheckoutEnabled: boolean;
  enabledMethods: string[];
  pointsPerCurrency: number;
  redeemValue: number;
  minOrderAmount: number;
}

@Injectable()
export class PricingService {
  private settingsCache?: { at: number; value: StoreSettings };

  constructor(private readonly prisma: PrismaService) {}

  async storeSettings(): Promise<StoreSettings> {
    if (this.settingsCache && Date.now() - this.settingsCache.at < 30_000) {
      return this.settingsCache.value;
    }
    const rows = await this.prisma.setting.findMany({
      where: {
        key: {
          in: [
            'store.currency',
            'shipping.freeShippingThreshold',
            'checkout.codEnabled',
            'checkout.guestEnabled',
            'checkout.minOrderAmount',
            'payment.enabledMethods',
            'loyalty.pointsPerCurrency',
            'loyalty.redeemValue',
          ],
        },
      },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const value: StoreSettings = {
      currency: (map.get('store.currency') as string) ?? 'INR',
      freeShippingThreshold: numberOrNull(map.get('shipping.freeShippingThreshold')),
      codEnabled: map.get('checkout.codEnabled') !== false,
      guestCheckoutEnabled: map.get('checkout.guestEnabled') !== false,
      minOrderAmount: Number(map.get('checkout.minOrderAmount') ?? 0),
      enabledMethods:
        (map.get('payment.enabledMethods') as string[] | undefined) ??
        ['COD', 'CARD', 'UPI', 'NETBANKING'],
      pointsPerCurrency: Number(map.get('loyalty.pointsPerCurrency') ?? 1),
      redeemValue: Number(map.get('loyalty.redeemValue') ?? 0.25),
    };
    this.settingsCache = { at: Date.now(), value };
    return value;
  }

  async shippingOptions(pincode?: string): Promise<ShippingChoice[]> {
    const rates = await this.prisma.shippingRate.findMany({
      where: { isActive: true, zone: { isActive: true } },
      orderBy: { sortOrder: 'asc' },
    });
    // Pincode serviceability is advisory in Phase 3 — every active rate is offered,
    // but an explicitly non-serviceable pincode disables COD.
    let codAllowed = true;
    if (pincode) {
      const svc = await this.prisma.serviceablePincode.findUnique({ where: { pincode } });
      if (svc) codAllowed = svc.codAvailable;
    }
    return rates.map((r) => ({
      id: r.id,
      name: r.name,
      price: toNumber(r.price),
      codFee: toNumber(r.codFee),
      freeAboveAmount: r.freeAboveAmount == null ? null : toNumber(r.freeAboveAmount),
      codAvailable: r.codAvailable && codAllowed,
      minDeliveryDays: r.minDeliveryDays,
      maxDeliveryDays: r.maxDeliveryDays,
    }));
  }

  async resolveCoupon(
    code: string,
    ctx: { subtotal: number; userId?: string },
  ): Promise<{ coupon: { code: string; description: string | null }; discount: number }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();
    if (
      !coupon ||
      !coupon.isActive ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now)
    ) {
      throw new CouponError('This code is not valid.');
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new CouponError('This code has reached its usage limit.');
    }
    if (coupon.minOrderAmount != null && ctx.subtotal < toNumber(coupon.minOrderAmount)) {
      throw new CouponError(
        `Add ₹${toNumber(coupon.minOrderAmount) - ctx.subtotal} more to use this code.`,
      );
    }
    if (coupon.allowedUserIds.length > 0 && (!ctx.userId || !coupon.allowedUserIds.includes(ctx.userId))) {
      throw new CouponError('This code is not available on your account.');
    }
    if (ctx.userId && coupon.usageLimitPerUser > 0) {
      const used = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId: ctx.userId },
      });
      if (used >= coupon.usageLimitPerUser) {
        throw new CouponError('You have already used this code.');
      }
    }

    let discount = 0;
    switch (coupon.type) {
      case 'PERCENTAGE':
        discount = (ctx.subtotal * toNumber(coupon.value)) / 100;
        if (coupon.maxDiscountAmount != null) {
          discount = Math.min(discount, toNumber(coupon.maxDiscountAmount));
        }
        break;
      case 'FIXED':
        discount = toNumber(coupon.value);
        break;
      case 'FREE_SHIPPING':
        discount = 0; // handled as free shipping in computeTotals
        break;
      case 'BOGO':
        discount = 0; // not supported in Phase 3
        break;
    }
    discount = round2(Math.min(discount, ctx.subtotal));
    return { coupon: { code: coupon.code, description: coupon.description }, discount };
  }

  async computeTotals(input: {
    lines: PriceLine[];
    shipping?: ShippingChoice | null;
    couponCode?: string | null;
    paymentMethod?: string | null;
    userId?: string;
  }): Promise<Totals> {
    const settings = await this.storeSettings();
    const itemsSubtotal = round2(
      input.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    );
    const taxTotal = round2(
      input.lines.reduce((sum, l) => {
        const gross = l.unitPrice * l.quantity;
        const rate = l.taxRatePct / 100;
        return sum + (rate > 0 ? gross - gross / (1 + rate) : 0);
      }, 0),
    );

    let coupon: Totals['coupon'] = null;
    let discountTotal = 0;
    let freeShippingFromCoupon = false;
    if (input.couponCode) {
      try {
        const resolved = await this.resolveCoupon(input.couponCode, {
          subtotal: itemsSubtotal,
          userId: input.userId,
        });
        discountTotal = resolved.discount;
        coupon = { ...resolved.coupon, discount: resolved.discount };
        const full = await this.prisma.coupon.findUnique({
          where: { code: input.couponCode.toUpperCase() },
          select: { type: true },
        });
        freeShippingFromCoupon = full?.type === 'FREE_SHIPPING';
      } catch {
        coupon = null;
        discountTotal = 0;
      }
    }

    const netSubtotal = itemsSubtotal - discountTotal;
    const threshold = settings.freeShippingThreshold;
    // Delivery is free on every order and Cash on Delivery carries no fee.
    // `freeShippingFromCoupon` is still consumed above; the value is always 0.
    void freeShippingFromCoupon;
    const shippingTotal = 0;

    const grandTotal = round2(netSubtotal + shippingTotal);
    const amountToFreeShipping = 0;

    return {
      currency: settings.currency,
      itemsSubtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      grandTotal,
      coupon,
      freeShippingThreshold: threshold,
      amountToFreeShipping,
    };
  }

  loyaltyPointsFor(amount: number, pointsPerCurrency = 1): number {
    return Math.floor(amount * pointsPerCurrency);
  }
}

export class CouponError extends Error {}

function numberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// re-export for consumers that only need the value type
export type { Prisma };
