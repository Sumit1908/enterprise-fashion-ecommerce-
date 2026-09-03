import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type OrderStatus, type PaymentMethod } from '@slay/db';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CartService, type CartContext } from '../cart/cart.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { PincodeService } from '../geo/pincode.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { BRAND } from '../common/brand.js';
import type { PaymentInitResult } from '../payments/payment-provider.js';
import { money, round2, toNumber } from '../common/money.js';
import type { AddressDto, PlaceOrderDto } from './orders.dto.js';

const env = loadEnv();

const ORDER_INCLUDE = {
  items: { orderBy: { id: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  shipments: { include: { trackingEvents: { orderBy: { occurredAt: 'asc' as const } } } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** The client handed to an interactive `$transaction` callback (extension-aware). */
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly email: EmailService,
    private readonly pincode: PincodeService,
    private readonly shipping: ShippingService,
  ) {}

  /* ------------------------------------------------------------- placement */

  async placeOrder(
    ctx: CartContext,
    dto: PlaceOrderDto,
    meta: { ip?: string },
  ): Promise<{ order: ReturnType<typeof publicOrder>; payment: PaymentInitResult }> {
    const cart = await this.cart.resolveCart(ctx);
    if (!cart) throw new BadRequestException('Your cart is empty');
    const lines = await this.cart.rawItems(cart.id);
    if (lines.length === 0) throw new BadRequestException('Your cart is empty');

    const settings = await this.pricing.storeSettings();
    if (!ctx.userId && !settings.guestCheckoutEnabled) {
      throw new ForbiddenException('Please sign in to check out');
    }
    if (!ctx.userId && !dto.email) {
      throw new BadRequestException('An email address is required for guest checkout');
    }

    // Re-validate stock.
    const shortages = lines.filter((l) => l.quantity > l.availableStock);
    if (shortages.length > 0) {
      throw new BadRequestException({
        message: 'Some items are no longer available in the requested quantity',
        items: shortages.map((s) => ({
          variantId: s.variantId,
          requested: s.quantity,
          available: s.availableStock,
        })),
      });
    }

    // Authoritative address check — real PIN, serviceable, and the submitted
    // city/state actually belong to it. Throws HTTP 400 with a clear message
    // otherwise. The client's city/state/district are never trusted past here.
    const geo = await this.pincode.assertDeliverableAddress({
      line1: dto.shippingAddress.line1,
      pincode: dto.shippingAddress.pincode,
      city: dto.shippingAddress.city,
      state: dto.shippingAddress.state,
    });
    const verifiedShippingAddress: AddressDto = {
      ...dto.shippingAddress,
      city: geo.city,
      state: geo.state,
      district: geo.district,
    };

    // Shipping + payment method. There is a single free-delivery option; accept a
    // stale/absent rate id and fall back to it rather than failing checkout.
    const shippingOptions = await this.pricing.shippingOptions(dto.shippingAddress.pincode);
    const shipping =
      shippingOptions.find((s) => s.id === dto.shippingRateId) ?? shippingOptions[0];
    if (!shipping) throw new BadRequestException('Delivery is not available right now');
    if (dto.paymentMethod === 'COD' && (!shipping.codAvailable || !geo.codAvailable)) {
      throw new BadRequestException('Cash on Delivery is not available for this address / method');
    }

    const method = dto.paymentMethod as PaymentMethod;
    const allowed = this.payments.enabledMethods(settings.enabledMethods);
    if (!allowed.includes(method)) {
      throw new BadRequestException(`${method} is not available right now`);
    }

    const priceLines = lines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      taxRatePct: l.taxRatePct,
    }));
    const totals = await this.pricing.computeTotals({
      lines: priceLines,
      shipping,
      couponCode: dto.couponCode ?? undefined,
      paymentMethod: method,
      userId: ctx.userId,
    });

    if (totals.itemsSubtotal < settings.minOrderAmount) {
      throw new BadRequestException(`Minimum order value is ₹${settings.minOrderAmount}`);
    }

    const coupon = dto.couponCode
      ? await this.prisma.coupon.findUnique({ where: { code: dto.couponCode.toUpperCase() } })
      : null;

    const provider = this.payments.providerFor(method);
    const orderNumber = await this.nextOrderNumber();

    // Apportion order-level discount across lines (for the OrderItem snapshots).
    const grossSubtotal = totals.itemsSubtotal || 1;
    const wh = await this.defaultWarehouseId();

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: ctx.userId ?? null,
          guestEmail: ctx.userId ? null : (dto.email ?? null),
          guestPhone: ctx.userId ? null : (dto.phone ?? dto.shippingAddress.phone),
          status: 'PENDING',
          paymentStatus: 'PENDING',
          currency: totals.currency,
          itemsSubtotal: money(totals.itemsSubtotal),
          discountTotal: money(totals.discountTotal),
          shippingTotal: money(totals.shippingTotal),
          taxTotal: money(totals.taxTotal),
          grandTotal: money(totals.grandTotal),
          couponCode: totals.coupon?.code ?? null,
          couponId: totals.coupon ? coupon?.id ?? null : null,
          shippingAddress: addressJson(verifiedShippingAddress),
          billingAddress: addressJson(dto.billingAddress ?? verifiedShippingAddress),
          customerNote: dto.customerNote ?? null,
          ipAddress: meta.ip ?? null,
          channel: 'web',
          statusHistory: { create: { status: 'PENDING', note: 'Order placed' } },
        },
      });

      for (const line of lines) {
        const v = line.variant;
        const gross = line.unitPrice * line.quantity;
        const lineDiscount = round2((gross / grossSubtotal) * totals.discountTotal);
        const net = gross - lineDiscount;
        const rate = line.taxRatePct / 100;
        const lineTax = rate > 0 ? round2(net - net / (1 + rate)) : 0;
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId: line.productId,
            variantId: line.variantId,
            productName: v.product.name,
            variantLabel:
              v.optionValues.map((o) => o.optionValue.value).join(' / ') || null,
            sku: v.sku,
            imageUrl: v.product.media[0]?.url ?? null,
            unitMrp: money(toNumber(v.product.mrp)),
            unitPrice: money(line.unitPrice),
            quantity: line.quantity,
            discountTotal: money(lineDiscount),
            taxRate: line.taxRatePct.toFixed(2),
            taxTotal: money(lineTax),
            lineTotal: money(net),
          },
        });
        await this.reserveStock(tx, wh, line.variantId, line.quantity, created.id);
      }

      const payment = await tx.payment.create({
        data: {
          orderId: created.id,
          method,
          status: 'PENDING',
          amount: money(totals.grandTotal),
          currency: totals.currency,
          gateway: provider.id,
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { convertedOrderId: created.id },
      });

      return { ...created, paymentId: payment.id };
    }, { timeout: 20_000 });

    // Kick off the payment with the provider (outside the DB transaction).
    const initResult = await this.payments.initiate(method, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: order.paymentId,
      amount: totals.grandTotal,
      currency: totals.currency,
      method,
      customer: {
        email: dto.email ?? order.guestEmail,
        phone: dto.shippingAddress.phone,
        name: dto.shippingAddress.fullName,
      },
    });

    await this.prisma.payment.update({
      where: { id: order.paymentId },
      data: {
        gatewayOrderId: initResult.providerOrderId ?? null,
        gatewayResponse: (initResult.clientConfig ?? {}) as Prisma.InputJsonValue,
      },
    });

    // COD / already-paid providers finalise immediately.
    if (!initResult.requiresClientAction) {
      await this.finalizePayment(order.paymentId, { source: 'immediate', codPending: method === 'COD' });
    }

    const fresh = await this.getById(order.id);
    return { order: publicOrder(fresh), payment: initResult };
  }

  /* ------------------------------------------------------ payment lifecycle */

  /**
   * Move a payment to PAID and confirm its order. Idempotent — safe to call from
   * the client callback AND the webhook.
   */
  async finalizePayment(
    paymentId: string,
    details: {
      providerPaymentId?: string;
      gatewayResponse?: unknown;
      source: string;
      codPending?: boolean;
    },
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: { items: true, user: { select: { email: true, firstName: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'PAID') return; // already done

    const order = payment.order;
    const codPending = details.codPending ?? payment.method === 'COD';
    const wh = await this.defaultWarehouseId();

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: codPending ? 'PENDING' : 'PAID',
          paidAt: codPending ? null : new Date(),
          gatewayPaymentId: details.providerPaymentId ?? payment.gatewayPaymentId,
          gatewayResponse: mergeJson(payment.gatewayResponse, {
            finalizedBy: details.source,
            ...(details.gatewayResponse && typeof details.gatewayResponse === 'object'
              ? (details.gatewayResponse as Record<string, unknown>)
              : {}),
          }),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CONFIRMED',
          paymentStatus: codPending ? 'PENDING' : 'PAID',
          confirmedAt: new Date(),
          statusHistory: {
            create: {
              status: 'CONFIRMED',
              note: codPending ? 'Order confirmed (Cash on Delivery)' : 'Payment received',
            },
          },
        },
      });

      // Commit reserved stock -> sold.
      for (const item of order.items) {
        if (!item.variantId) continue;
        await this.commitStock(tx, wh, item.variantId, item.quantity, order.id);
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { soldCount: { increment: item.quantity } },
          });
        }
      }

      // Convert the cart.
      await tx.cart.updateMany({
        where: { convertedOrderId: order.id },
        data: { status: 'CONVERTED' },
      });
      await tx.cartItem.deleteMany({
        where: { cart: { convertedOrderId: order.id } },
      });

      // Coupon redemption.
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponRedemption.create({
          data: {
            couponId: order.couponId,
            userId: order.userId,
            orderId: order.id,
            amount: order.discountTotal,
          },
        });
      }

      // Loyalty points (only for logged-in customers, on real payment).
      if (order.userId && !codPending) {
        const settings = await this.pricing.storeSettings();
        const points = this.pricing.loyaltyPointsFor(
          toNumber(order.grandTotal),
          settings.pointsPerCurrency,
        );
        if (points > 0) {
          const account = await tx.loyaltyAccount.upsert({
            where: { userId: order.userId },
            create: { userId: order.userId, pointsBalance: points, lifetimePoints: points },
            update: {
              pointsBalance: { increment: points },
              lifetimePoints: { increment: points },
            },
          });
          await tx.loyaltyTransaction.create({
            data: {
              accountId: account.id,
              type: 'EARN',
              points,
              description: `Order ${order.orderNumber}`,
              orderId: order.id,
            },
          });
        }
      }

      await tx.notification.create({
        data: {
          userId: order.userId,
          channel: 'EMAIL',
          type: 'ORDER_UPDATE',
          status: 'QUEUED',
          title: `Order ${order.orderNumber} confirmed`,
          body: `We've received your order. Total ${order.currency} ${order.grandTotal}.`,
          data: { orderId: order.id, orderNumber: order.orderNumber },
        },
      });
    }, { timeout: 20_000 });

    this.logger.log(`Order ${order.orderNumber} finalised (${details.source})`);

    // Hand the confirmed order to Shiprocket — best-effort, never blocks or
    // fails the order. No-op unless Shiprocket is configured + auto-create is on.
    void this.shipping
      .autoCreateForOrder(order.id)
      .catch((e) => this.logger.warn(`Shiprocket auto-create skipped: ${(e as Error).message}`));

    // Order confirmation email — best-effort, never blocks the order.
    const to = payment.order.user?.email ?? payment.order.guestEmail;
    if (to) {
      void this.sendOrderConfirmation(to, payment.order.user?.firstName ?? null, {
        orderNumber: order.orderNumber,
        currency: order.currency,
        grandTotal: order.grandTotal.toString(),
        codPending,
        items: payment.order.items.map((i) => ({
          name: i.productName,
          label: i.variantLabel,
          qty: i.quantity,
          lineTotal: i.lineTotal.toString(),
        })),
        shippingAddress: order.shippingAddress,
      }).catch((e) => this.logger.warn(`Order email skipped: ${(e as Error).message}`));
    }
  }

  private async sendOrderConfirmation(
    to: string,
    firstName: string | null,
    o: {
      orderNumber: string;
      currency: string;
      grandTotal: string;
      codPending: boolean;
      items: { name: string; label: string | null; qty: number; lineTotal: string }[];
      shippingAddress: Prisma.JsonValue;
    },
  ): Promise<void> {
    if (!this.email.configured) return;
    const track = `${env.WEB_URL}/order/${o.orderNumber}?email=${encodeURIComponent(to)}`;
    const addr = (o.shippingAddress ?? {}) as Record<string, unknown>;
    const addrLine = [addr.fullName, addr.line1, addr.line2, addr.city, addr.state, addr.pincode]
      .filter(Boolean)
      .map((x) => esc(String(x)))
      .join(', ');
    const rows = o.items
      .map(
        (i) =>
          `<tr><td style="padding:6px 0">${esc(i.name)}${
            i.label ? ` <span style="color:#8c8377">(${esc(i.label)})</span>` : ''
          } × ${i.qty}</td><td style="padding:6px 0;text-align:right">${o.currency} ${esc(i.lineTotal)}</td></tr>`,
      )
      .join('');
    const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi,';
    const pay = o.codPending
      ? `Payment: Cash on Delivery — please keep ${o.currency} ${esc(o.grandTotal)} ready for the delivery agent.`
      : `Payment received.`;

    const result = await this.email.send({
      to,
      subject: `${BRAND.name} — order ${o.orderNumber} confirmed`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#191512">
          <p style="letter-spacing:.2em;text-transform:uppercase;font-size:12px;color:#a5813f;font-family:Georgia,serif">${BRAND.name}</p>
          <h1 style="font-size:22px;font-weight:600;font-family:Georgia,serif">Your order is confirmed</h1>
          <p style="font-size:14px;line-height:1.6;color:#5f574e">${hi} thank you for your order <strong>${o.orderNumber}</strong>. We&rsquo;re getting it ready and will email a tracking link once it ships.</p>
          <table style="width:100%;font-size:14px;border-top:1px solid #e7dfd0;border-bottom:1px solid #e7dfd0;margin:16px 0">${rows}
            <tr><td style="padding:10px 0;font-weight:700">Total</td><td style="padding:10px 0;text-align:right;font-weight:700">${o.currency} ${esc(o.grandTotal)}</td></tr>
          </table>
          <p style="font-size:13px;color:#5f574e">${pay}</p>
          ${addrLine ? `<p style="font-size:13px;color:#5f574e">Delivering to: ${addrLine}</p>` : ''}
          <p style="margin:20px 0"><a href="${track}" style="background:#191512;color:#fff;padding:10px 18px;text-decoration:none;font-size:13px">Track your order</a></p>
          <p style="font-size:12px;color:#8c8377;border-top:1px solid #e7dfd0;padding-top:12px">
            Need help? Email <a href="mailto:${BRAND.email}" style="color:#8c8377">${BRAND.email}</a> or WhatsApp ${BRAND.phoneDisplay}.<br>
            ${BRAND.name}, ${BRAND.addressInline}
          </p>
        </div>`,
    });

    await this.prisma.notification
      .updateMany({
        where: {
          channel: 'EMAIL',
          status: 'QUEUED',
          title: `Order ${o.orderNumber} confirmed`,
        },
        data: {
          status: result.delivered ? 'SENT' : 'FAILED',
          sentAt: result.delivered ? new Date() : null,
          error: result.delivered ? null : (result.reason ?? 'not delivered'),
        },
      })
      .catch(() => undefined);
  }

  async failPayment(paymentId: string, reason: string, source: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === 'PAID' || payment.status === 'FAILED') return;
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', failureReason: `${reason} (${source})` },
    });
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: 'FAILED',
        statusHistory: { create: { status: 'PENDING', note: `Payment failed: ${reason}` } },
      },
    });
  }

  async verifyFromClient(
    ctx: CartContext & { email?: string },
    input: {
      orderNumber: string;
      providerOrderId?: string;
      providerPaymentId?: string;
      signature?: string;
      mockOutcome?: 'success' | 'failure';
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: input.orderNumber },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.assertOwnership(order, ctx);

    const payment = order.payments[0];
    if (!payment) throw new BadRequestException('No payment to verify');
    if (payment.status === 'PAID') {
      return { status: 'paid', orderNumber: order.orderNumber };
    }

    const result = await this.payments.verify(payment.gateway ?? 'mock', {
      paymentId: payment.id,
      orderNumber: order.orderNumber,
      amount: toNumber(payment.amount),
      providerOrderId: input.providerOrderId ?? payment.gatewayOrderId ?? undefined,
      providerPaymentId: input.providerPaymentId,
      signature: input.signature,
      mockOutcome: input.mockOutcome,
    });

    if (!result.ok) {
      await this.failPayment(payment.id, result.reason ?? 'Verification failed', 'client');
      throw new BadRequestException(result.reason ?? 'Payment could not be verified');
    }

    await this.finalizePayment(payment.id, {
      providerPaymentId: result.providerPaymentId,
      gatewayResponse: result.raw,
      source: 'client-verify',
    });
    return { status: 'paid', orderNumber: order.orderNumber };
  }

  async handleWebhook(
    provider: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const result = this.payments.verifyWebhook(provider, rawBody, headers);
    if (!result.ok) {
      this.logger.warn(`Rejected ${provider} webhook: ${result.reason}`);
      throw new BadRequestException(result.reason ?? 'Invalid webhook');
    }
    if (!result.handled || !result.paymentId) {
      return { received: true, handled: false, event: result.event };
    }
    if (result.outcome === 'paid') {
      await this.finalizePayment(result.paymentId, {
        providerPaymentId: result.providerPaymentId,
        gatewayResponse: result.raw,
        source: `webhook:${result.event}`,
      });
    } else if (result.outcome === 'failed') {
      await this.failPayment(result.paymentId, result.event ?? 'gateway failure', 'webhook');
    }
    return { received: true, handled: true, event: result.event };
  }

  async retryPayment(
    ctx: CartContext & { email?: string },
    orderNumber: string,
    method: PaymentMethod,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.assertOwnership(order, ctx);
    if (order.paymentStatus === 'PAID' || order.status !== 'PENDING') {
      throw new BadRequestException('This order can no longer be paid online');
    }

    const provider = this.payments.providerFor(method);
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method,
        status: 'PENDING',
        amount: order.grandTotal,
        currency: order.currency,
        gateway: provider.id,
      },
    });

    const init = await this.payments.initiate(method, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      amount: toNumber(order.grandTotal),
      currency: order.currency,
      method,
      customer: { email: order.guestEmail, phone: order.guestPhone },
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayOrderId: init.providerOrderId ?? null,
        gatewayResponse: (init.clientConfig ?? {}) as Prisma.InputJsonValue,
      },
    });
    if (!init.requiresClientAction) {
      await this.finalizePayment(payment.id, { source: 'retry', codPending: method === 'COD' });
    }
    const fresh = await this.getById(order.id);
    return { order: publicOrder(fresh), payment: init };
  }

  /* --------------------------------------------------------------- reads */

  async listForCustomer(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: 'desc' },
      take: 50,
      include: { items: { select: { productName: true, imageUrl: true, quantity: true } } },
    });
    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      grandTotal: o.grandTotal.toString(),
      currency: o.currency,
      placedAt: o.placedAt,
      itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
      preview: o.items.slice(0, 3),
    }));
  }

  async getForCustomer(orderNumber: string, ctx: CartContext & { email?: string }) {
    const order = await this.getByNumber(orderNumber);
    await this.assertOwnership(order, ctx);
    return publicOrder(order);
  }

  /* ---------------------------------------------------------------- admin */

  async adminGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...ORDER_INCLUDE,
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async adminSetStatus(id: string, status: OrderStatus, note: string | undefined, actorId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');

    const patch: Prisma.OrderUpdateInput = {
      status,
      statusHistory: { create: { status, note: note ?? null, createdById: actorId ?? null } },
    };
    if (status === 'DELIVERED') patch.deliveredAt = new Date();
    if (status === 'CANCELLED') {
      patch.cancelledAt = new Date();
      patch.cancelReason = note ?? null;
    }

    const wh = status === 'CANCELLED' ? await this.defaultWarehouseId() : '';
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: patch });
      if (status === 'CANCELLED') {
        for (const item of order.items) {
          if (!item.variantId) continue;
          // Not-yet-paid: just release the reservation. Paid: return sold stock.
          if (order.paymentStatus === 'PAID') {
            await this.returnStock(tx, wh, item.variantId, item.quantity, id);
          } else {
            await this.releaseStock(tx, wh, item.variantId, item.quantity, id);
          }
        }
      }
    }, { timeout: 20_000 });
    return this.adminGet(id);
  }

  /* ------------------------------------------------------------- internals */

  private async getById(id: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async getByNumber(orderNumber: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async assertOwnership(
    order: { id: string; userId: string | null; guestEmail: string | null },
    ctx: CartContext & { email?: string },
  ): Promise<void> {
    if (order.userId) {
      if (order.userId === ctx.userId) return;
      throw new ForbiddenException('This order belongs to another account');
    }
    // Guest order: either the email that placed it, or the browser session
    // (cart token) that placed it.
    if (ctx.email && order.guestEmail && ctx.email.toLowerCase() === order.guestEmail.toLowerCase()) {
      return;
    }
    if (ctx.cartToken) {
      const cart = await this.prisma.cart.findFirst({
        where: { convertedOrderId: order.id, sessionToken: ctx.cartToken },
        select: { id: true },
      });
      if (cart) return;
    }
    throw new ForbiddenException('Provide the email used to place this order');
  }

  private async nextOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.order.count();
      const seq = count + 1 + (attempt === 0 ? 0 : Math.floor(Math.random() * 97) + 1);
      const candidate = `SJ-${year}-${String(seq).padStart(6, '0')}`;
      const clash = await this.prisma.order.findUnique({
        where: { orderNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    return `SJ-${year}-${Date.now().toString(36).toUpperCase()}`;
  }

  private async defaultWarehouseId(): Promise<string> {
    const wh = await this.prisma.warehouse.findFirst({
      orderBy: { priority: 'desc' },
      select: { id: true },
    });
    if (!wh) throw new BadRequestException('No warehouse configured');
    return wh.id;
  }

  private async reserveStock(tx: Tx, wh: string, variantId: string, qty: number, ref: string) {
    await tx.inventoryLevel.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId: wh } },
      create: { variantId, warehouseId: wh, onHand: 0, reserved: qty },
      update: { reserved: { increment: qty } },
    });
    await tx.stockMovement.create({
      data: { variantId, warehouseId: wh, type: 'RESERVATION', quantity: -qty, reference: ref },
    });
  }

  private async commitStock(tx: Tx, wh: string, variantId: string, qty: number, ref: string) {
    const level = await tx.inventoryLevel.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId: wh } },
    });
    await tx.inventoryLevel.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId: wh } },
      create: { variantId, warehouseId: wh, onHand: 0, reserved: 0 },
      update: {
        onHand: { decrement: qty },
        reserved: { set: Math.max(0, (level?.reserved ?? 0) - qty) },
      },
    });
    await tx.stockMovement.create({
      data: { variantId, warehouseId: wh, type: 'SALE', quantity: -qty, reference: ref },
    });
  }

  private async releaseStock(tx: Tx, wh: string, variantId: string, qty: number, ref: string) {
    const level = await tx.inventoryLevel.findUnique({
      where: { variantId_warehouseId: { variantId, warehouseId: wh } },
    });
    if (!level) return;
    await tx.inventoryLevel.update({
      where: { variantId_warehouseId: { variantId, warehouseId: wh } },
      data: { reserved: { set: Math.max(0, level.reserved - qty) } },
    });
    await tx.stockMovement.create({
      data: { variantId, warehouseId: wh, type: 'RELEASE', quantity: qty, reference: ref },
    });
  }

  private async returnStock(tx: Tx, wh: string, variantId: string, qty: number, ref: string) {
    await tx.inventoryLevel.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId: wh } },
      create: { variantId, warehouseId: wh, onHand: qty, reserved: 0 },
      update: { onHand: { increment: qty } },
    });
    await tx.stockMovement.create({
      data: { variantId, warehouseId: wh, type: 'RETURN', quantity: qty, reference: ref },
    });
  }
}

/* ------------------------------------------------------------------ helpers */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function addressJson(a: AddressDto): Prisma.InputJsonValue {
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? null,
    landmark: a.landmark ?? null,
    city: a.city,
    district: a.district ?? null,
    state: a.state,
    pincode: a.pincode,
    country: a.country ?? 'IN',
  };
}

function mergeJson(existing: Prisma.JsonValue | null, extra: Record<string, unknown>): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...extra } as Prisma.InputJsonValue;
}

export function publicOrder(order: OrderWithRelations) {
  const latestPayment = order.payments[0];
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    placedAt: order.placedAt,
    confirmedAt: order.confirmedAt,
    deliveredAt: order.deliveredAt,
    customerNote: order.customerNote,
    totals: {
      itemsSubtotal: order.itemsSubtotal.toString(),
      discountTotal: order.discountTotal.toString(),
      shippingTotal: order.shippingTotal.toString(),
      taxTotal: order.taxTotal.toString(),
      grandTotal: order.grandTotal.toString(),
    },
    couponCode: order.couponCode,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantLabel: i.variantLabel,
      sku: i.sku,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice.toString(),
      quantity: i.quantity,
      lineTotal: i.lineTotal.toString(),
    })),
    payment: latestPayment
      ? {
          method: latestPayment.method,
          status: latestPayment.status,
          gateway: latestPayment.gateway,
          gatewayOrderId: latestPayment.gatewayOrderId,
        }
      : null,
    timeline: order.statusHistory.map((e) => ({
      status: e.status,
      note: e.note,
      at: e.createdAt,
    })),
    shipments: order.shipments
      .filter((s) => !s.cancelledAt)
      .map((s) => ({
        provider: s.provider,
        awbNumber: s.awbNumber,
        courierName: s.courierName,
        status: s.status,
        rawStatus: s.rawStatus,
        trackingUrl: s.trackingUrl,
        estimatedDelivery: s.estimatedDelivery,
        shippedAt: s.shippedAt,
        deliveredAt: s.deliveredAt,
        events: s.trackingEvents.map((t) => ({
          status: t.status,
          message: t.message,
          location: t.location,
          at: t.occurredAt,
        })),
      })),
  };
}
