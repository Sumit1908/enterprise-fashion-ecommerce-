import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@slay/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { round2, toNumber } from '../common/money.js';

export interface CartContext {
  userId?: string;
  cartToken?: string;
}

const VARIANT_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      deletedAt: true,
      currency: true,
      salePrice: true,
      mrp: true,
      taxClass: { select: { rate: true } },
      media: { select: { url: true }, orderBy: { position: 'asc' as const }, take: 1 },
    },
  },
  optionValues: { include: { optionValue: { select: { value: true } } } },
  inventory: { select: { onHand: true, reserved: true } },
} satisfies Prisma.ProductVariantInclude;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /** Find or create the active cart for this visitor. Returns the cart id + token. */
  async resolveCart(
    ctx: CartContext,
    opts: { create?: boolean } = {},
  ): Promise<{ id: string; token: string } | null> {
    // Logged-in user: their user cart wins; merge a guest cart into it if present.
    if (ctx.userId) {
      let cart = await this.prisma.cart.findFirst({
        where: { userId: ctx.userId, status: 'ACTIVE' },
        select: { id: true, sessionToken: true },
      });
      if (!cart && !opts.create) return null;
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId: ctx.userId, sessionToken: newToken() },
          select: { id: true, sessionToken: true },
        });
      }
      if (ctx.cartToken && ctx.cartToken !== cart.sessionToken) {
        await this.mergeGuestCart(ctx.cartToken, cart.id);
      }
      return { id: cart.id, token: cart.sessionToken! };
    }

    // Guest: keyed by the opaque cart token.
    if (ctx.cartToken) {
      const cart = await this.prisma.cart.findFirst({
        where: { sessionToken: ctx.cartToken, status: 'ACTIVE' },
        select: { id: true, sessionToken: true },
      });
      if (cart) return { id: cart.id, token: cart.sessionToken! };
    }
    if (!opts.create) return null;
    const created = await this.prisma.cart.create({
      data: { sessionToken: newToken() },
      select: { id: true, sessionToken: true },
    });
    return { id: created.id, token: created.sessionToken! };
  }

  private async mergeGuestCart(guestToken: string, targetCartId: string): Promise<void> {
    const guest = await this.prisma.cart.findFirst({
      where: { sessionToken: guestToken, status: 'ACTIVE', id: { not: targetCartId } },
      include: { items: true },
    });
    if (!guest || guest.items.length === 0) {
      if (guest) {
        await this.prisma.cart.update({ where: { id: guest.id }, data: { status: 'MERGED' } });
      }
      return;
    }
    for (const item of guest.items) {
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: targetCartId, variantId: item.variantId } },
        create: {
          cartId: targetCartId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        },
        update: { quantity: { increment: item.quantity } },
      });
    }
    await this.prisma.cart.update({ where: { id: guest.id }, data: { status: 'MERGED' } });
  }

  async addItem(ctx: CartContext, variantId: string, quantity: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: VARIANT_INCLUDE,
    });
    if (!variant || !variant.isActive || variant.product.deletedAt || variant.product.status !== 'ACTIVE') {
      throw new NotFoundException('This item is no longer available');
    }
    const available = availableStock(variant.inventory);
    const cart = (await this.resolveCart(ctx, { create: true }))!;
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const nextQty = (existing?.quantity ?? 0) + quantity;
    if (available <= 0) throw new BadRequestException('This item is out of stock');
    if (nextQty > available) {
      throw new BadRequestException(`Only ${available} left in stock`);
    }

    const unitPrice = currentUnitPrice(variant);
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: {
        cartId: cart.id,
        productId: variant.productId,
        variantId,
        quantity,
        unitPrice,
      },
      update: { quantity: nextQty, unitPrice },
    });
    void this.touch(cart.id);
    return this.view(ctx, cart.token);
  }

  async updateItem(ctx: CartContext, itemId: string, quantity: number) {
    const cart = await this.resolveCart(ctx);
    if (!cart) throw new NotFoundException('Cart not found');
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { variant: { include: { inventory: { select: { onHand: true, reserved: true } } } } },
    });
    if (!item) throw new NotFoundException('Item not in cart');

    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      const available = availableStock(item.variant.inventory);
      if (quantity > available) throw new BadRequestException(`Only ${available} left in stock`);
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    void this.touch(cart.id);
    return this.view(ctx, cart.token);
  }

  async removeItem(ctx: CartContext, itemId: string) {
    const cart = await this.resolveCart(ctx);
    if (!cart) throw new NotFoundException('Cart not found');
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    void this.touch(cart.id);
    return this.view(ctx, cart.token);
  }

  async setCoupon(ctx: CartContext, code: string | null) {
    const cart = await this.resolveCart(ctx, { create: true });
    if (!cart) throw new NotFoundException('Cart not found');
    if (code) {
      const view = await this.rawItems(cart.id);
      const subtotal = round2(view.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
      // resolveCoupon throws CouponError (mapped to 400 by the controller) on failure.
      await this.pricing.resolveCoupon(code, { subtotal, userId: ctx.userId });
    }
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: code ? code.toUpperCase() : null },
    });
    return this.view(ctx, cart.token);
  }

  async view(ctx: CartContext, forceToken?: string) {
    // One query: fetch the cart + everything the view needs.
    const cart = forceToken
      ? await this.prisma.cart.findFirst({
          where: { sessionToken: forceToken },
          include: {
            items: { orderBy: { addedAt: 'asc' }, include: { variant: { include: VARIANT_INCLUDE } } },
          },
        })
      : await (async () => {
          const resolved = await this.resolveCart(ctx);
          if (!resolved) return null;
          return this.prisma.cart.findUnique({
            where: { id: resolved.id },
            include: {
              items: { orderBy: { addedAt: 'asc' }, include: { variant: { include: VARIANT_INCLUDE } } },
            },
          });
        })();

    if (!cart) {
      const empty = await this.emptyTotals();
      return { token: null, items: [], itemCount: 0, coupon: null, summary: empty, notices: [] };
    }

    const notices: string[] = [];
    const items = cart.items.map((item) => {
      const v = item.variant;
      const available = availableStock(v.inventory);
      const livePrice = currentUnitPrice(v);
      const clampedQty = Math.min(item.quantity, Math.max(0, available));
      if (available <= 0) notices.push(`${v.product.name} is now out of stock and was removed from the total.`);
      else if (clampedQty < item.quantity) notices.push(`Only ${available} of ${v.product.name} left — quantity reduced.`);
      if (round2(livePrice) !== round2(toNumber(item.unitPrice))) {
        notices.push(`Price of ${v.product.name} changed to ₹${livePrice}.`);
      }
      return {
        id: item.id,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        variantId: v.id,
        sku: v.sku,
        variantLabel: v.optionValues.map((o) => o.optionValue.value).join(' / ') || null,
        imageUrl: v.product.media[0]?.url ?? null,
        unitPrice: money(livePrice),
        unitMrp: money(toNumber(v.product.mrp)),
        quantity: item.quantity,
        availableStock: available,
        inStock: available > 0,
        lineTotal: money(livePrice * clampedQty),
        taxRatePct: toNumber(v.product.taxClass?.rate),
      };
    });

    const priceLines = cart.items
      .map((item) => {
        const v = item.variant;
        const available = availableStock(v.inventory);
        return {
          unitPrice: currentUnitPrice(v),
          quantity: Math.min(item.quantity, Math.max(0, available)),
          taxRatePct: toNumber(v.product.taxClass?.rate),
        };
      })
      .filter((l) => l.quantity > 0);

    const summary = await this.pricing.computeTotals({
      lines: priceLines,
      couponCode: cart.couponCode,
      userId: ctx.userId,
    });

    return {
      token: cart.sessionToken,
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      coupon: summary.coupon,
      summary: {
        ...numericToStrings(summary),
      },
      notices: [...new Set(notices)],
    };
  }

  /** Raw line data for pricing (used by checkout too). */
  async rawItems(cartId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: { variant: { include: VARIANT_INCLUDE } },
    });
    return items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: currentUnitPrice(item.variant),
      availableStock: availableStock(item.variant.inventory),
      taxRatePct: toNumber(item.variant.product.taxClass?.rate),
    }));
  }

  private async touch(cartId: string): Promise<void> {
    await this.prisma.cart
      .update({ where: { id: cartId }, data: { updatedAt: new Date() } })
      .catch(() => undefined);
  }

  private async emptyTotals() {
    const t = await this.pricing.computeTotals({ lines: [] });
    return numericToStrings(t);
  }
}

/* ----------------------------------------------------------------- helpers */

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function availableStock(levels: { onHand: number; reserved: number }[]): number {
  return levels.reduce((sum, l) => sum + Math.max(0, l.onHand - l.reserved), 0);
}

function currentUnitPrice(variant: {
  salePrice: Prisma.Decimal | null;
  product: { salePrice: Prisma.Decimal };
}): number {
  return round2(toNumber(variant.salePrice ?? variant.product.salePrice));
}

function money(n: number): string {
  return round2(n).toFixed(2);
}

function numericToStrings<T extends object>(obj: T) {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    out[k] = typeof val === 'number' ? money(val) : val;
  }
  return out as { [K in keyof T]: T[K] extends number ? string : T[K] };
}
