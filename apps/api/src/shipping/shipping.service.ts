import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  FulfillmentStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
  type Shipment,
} from '@slay/db';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { toNumber } from '../common/money.js';
import { ShiprocketService } from './shiprocket.service.js';
import { ShiprocketError, type SrCreateOrderPayload, type SrWebhookBody } from './shiprocket.types.js';
import {
  SHIPMENT_STATUS_LABEL,
  mapShiprocketStatus,
  orderRank,
  orderStatusForShipment,
} from './status-map.js';

const env = loadEnv();
const PROVIDER = 'shiprocket';
const POLL_INTERVAL_MS = 45 * 60 * 1000;
const TERMINAL: ShipmentStatus[] = [ShipmentStatus.DELIVERED, ShipmentStatus.RTO];

interface CreateShipmentOptions {
  courierId?: number;
  weightKg?: number;
  dimensionsCm?: { length: number; breadth: number; height: number };
  assignAwb?: boolean;
  schedulePickup?: boolean;
  actorId?: string;
}

type ShipmentWithEvents = Prisma.ShipmentGetPayload<{ include: { trackingEvents: true } }>;

@Injectable()
export class ShippingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShippingService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sr: ShiprocketService,
  ) {}

  onModuleInit(): void {
    if (!this.sr.configured) {
      this.logger.log('Shiprocket not configured — shipping automation is idle.');
      return;
    }
    // Backstop for the webhook: refresh in-flight shipments periodically so the
    // customer/admin still see progress even if the webhook is not registered.
    this.pollTimer = setInterval(() => {
      void this.pollActiveShipments().catch((e) =>
        this.logger.warn(`Shipment poll failed: ${(e as Error).message}`),
      );
    }, POLL_INTERVAL_MS);
    this.pollTimer.unref?.();
    this.logger.log(
      `Shiprocket shipping enabled (pickup "${env.SHIPROCKET_PICKUP_LOCATION ?? 'auto'}", auto-create ${env.SHIPROCKET_AUTO_CREATE}).`,
    );
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /* ------------------------------------------------------------- status */

  async status() {
    let pickupLocations: string[] = [];
    if (this.sr.configured) {
      try {
        const list = await this.sr.listPickupLocations();
        pickupLocations =
          list.data?.shipping_address?.map((a) => a.pickup_location ?? '').filter(Boolean) ?? [];
      } catch {
        /* non-fatal */
      }
    }
    return {
      configured: this.sr.configured,
      provider: PROVIDER,
      pickupLocation: env.SHIPROCKET_PICKUP_LOCATION ?? null,
      pickupLocations,
      autoCreate: env.SHIPROCKET_AUTO_CREATE,
      autoAssignAwb: env.SHIPROCKET_AUTO_ASSIGN_AWB,
      webhookConfigured: Boolean(env.SHIPROCKET_WEBHOOK_TOKEN),
      webhookPath: '/api/v1/webhooks/shipping/shiprocket',
    };
  }

  /* ----------------------------------------------------- serviceability */

  async serviceabilityForOrder(orderId: string) {
    const order = await this.loadOrder(orderId);
    const pickupPincode = await this.pickupPincode();
    const deliveryPincode = String(this.addr(order).pincode ?? '');
    if (!/^\d{6}$/.test(deliveryPincode)) {
      throw new BadRequestException('Order has no valid 6-digit delivery pincode');
    }
    const cod = this.isCod(order);
    const weightKg = await this.parcelWeightKg(order);
    const res = await this.sr.checkServiceability({
      pickupPincode,
      deliveryPincode,
      weightKg,
      cod,
      declaredValue: toNumber(order.grandTotal),
    });
    const couriers = (res.data?.available_courier_companies ?? [])
      .filter((c) => !c.blocked)
      .map((c) => ({
        courierId: c.courier_company_id,
        name: c.courier_name,
        rate: c.rate,
        etd: c.etd ?? c.estimated_delivery_days ?? null,
        rating: c.rating ?? null,
        isSurface: Boolean(c.is_surface),
        codAvailable: Boolean(c.cod),
      }))
      .sort((a, b) => a.rate - b.rate);
    return {
      pickupPincode,
      deliveryPincode,
      cod,
      weightKg,
      recommendedCourierId: res.data?.recommended_courier_company_id ?? null,
      couriers,
    };
  }

  /* -------------------------------------------------- create a shipment */

  async createShipment(orderId: string, opts: CreateShipmentOptions = {}): Promise<ShipmentWithEvents> {
    if (!this.sr.configured) {
      throw new ServiceUnavailableException('Shiprocket is not configured on the server.');
    }
    const order = await this.loadOrder(orderId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is cancelled');
    }
    if (order.status === OrderStatus.PENDING) {
      throw new BadRequestException('Order is not confirmed yet');
    }

    const existing = await this.prisma.shipment.findFirst({
      where: { orderId, provider: PROVIDER, cancelledAt: null },
      include: { trackingEvents: { orderBy: { occurredAt: 'asc' } } },
    });
    if (existing?.providerShipmentId) {
      this.logger.log(`Order ${order.orderNumber} already has shipment ${existing.providerShipmentId}`);
      if (opts.assignAwb && !existing.awbNumber) {
        return this.assignAwb(existing.id, opts.courierId, opts.actorId);
      }
      return existing;
    }

    const pickupLocation = await this.resolvePickupLocation();
    const weightKg = opts.weightKg ?? (await this.parcelWeightKg(order));
    const dims = opts.dimensionsCm ?? {
      length: env.SHIPROCKET_DEFAULT_LENGTH_CM,
      breadth: env.SHIPROCKET_DEFAULT_BREADTH_CM,
      height: env.SHIPROCKET_DEFAULT_HEIGHT_CM,
    };

    const payload = this.buildOrderPayload(order, { pickupLocation, weightKg, dims });
    const created = await this.sr.createOrder(payload);
    if (!created.order_id || !created.shipment_id) {
      throw new ShiprocketError(
        created.message ?? 'Shiprocket did not return an order/shipment id',
        undefined,
        created,
      );
    }

    const shipment = await this.prisma.$transaction(async (tx) => {
      const fulfillment = await tx.fulfillment.create({
        data: {
          orderId: order.id,
          status: FulfillmentStatus.FULFILLED,
          lineItems: order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity })),
        },
      });
      const sh = await tx.shipment.create({
        data: {
          orderId: order.id,
          fulfillmentId: fulfillment.id,
          provider: PROVIDER,
          status: ShipmentStatus.LABEL_CREATED,
          rawStatus: created.status ?? 'NEW',
          providerOrderId: String(created.order_id),
          providerShipmentId: String(created.shipment_id),
          pickupLocation,
          weightGrams: Math.round(weightKg * 1000),
          appliedWeightGrams: Math.round(weightKg * 1000),
          courierId: created.courier_company_id ?? null,
          courierName: created.courier_name ?? null,
          awbNumber: created.awb_code ?? null,
          lastSyncedAt: new Date(),
        },
      });
      const bumpToProcessing = orderRank(order.status) < orderRank(OrderStatus.PROCESSING);
      await tx.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: FulfillmentStatus.FULFILLED,
          ...(bumpToProcessing ? { status: OrderStatus.PROCESSING } : {}),
          statusHistory: {
            create: {
              status: bumpToProcessing ? OrderStatus.PROCESSING : order.status,
              note: `Shiprocket shipment created (${created.shipment_id})`,
              createdById: opts.actorId ?? null,
            },
          },
        },
      });
      return sh;
    });

    this.logger.log(
      `Order ${order.orderNumber}: Shiprocket order ${created.order_id} / shipment ${created.shipment_id} created`,
    );

    let result = await this.withEvents(shipment.id);

    const wantAwb = opts.assignAwb ?? env.SHIPROCKET_AUTO_ASSIGN_AWB;
    if (wantAwb && !result.awbNumber) {
      try {
        result = await this.assignAwb(shipment.id, opts.courierId, opts.actorId);
      } catch (err) {
        this.logger.warn(
          `AWB auto-assign failed for ${order.orderNumber}: ${(err as Error).message}`,
        );
      }
    }
    if (opts.schedulePickup && result.awbNumber) {
      try {
        result = await this.schedulePickup(shipment.id, opts.actorId);
      } catch (err) {
        this.logger.warn(`Pickup auto-schedule failed for ${order.orderNumber}: ${(err as Error).message}`);
      }
    }
    return result;
  }

  /* ------------------------------------------------------------- AWB */

  async assignAwb(shipmentId: string, courierId?: number, actorId?: string): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (!shipment.providerShipmentId) throw new BadRequestException('Shipment not created on Shiprocket');
    if (shipment.awbNumber) return this.withEvents(shipmentId);

    const res = await this.sr.assignAwb(Number(shipment.providerShipmentId), courierId);
    const data = res.response?.data;
    if (!data?.awb_code) {
      throw new ShiprocketError(
        res.message ?? res.not_serviceable?.join(', ') ?? 'Shiprocket did not assign an AWB',
        undefined,
        res,
      );
    }
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        awbNumber: data.awb_code,
        courierId: data.courier_company_id ?? shipment.courierId,
        courierName: data.courier_name ?? shipment.courierName,
        appliedWeightGrams: data.applied_weight
          ? Math.round(data.applied_weight * 1000)
          : shipment.appliedWeightGrams,
        freightCharge:
          data.freight_charges != null ? new Prisma.Decimal(data.freight_charges) : shipment.freightCharge,
        trackingUrl: `https://shiprocket.co/tracking/${data.awb_code}`,
        rawStatus: 'AWB ASSIGNED',
        lastSyncedAt: new Date(),
      },
    });
    await this.appendOrderEvent(
      shipment.orderId,
      `AWB ${data.awb_code} assigned (${data.courier_name ?? 'courier'})`,
      actorId,
    );
    this.logger.log(`Shipment ${shipmentId}: AWB ${data.awb_code} via ${data.courier_name}`);
    return this.withEvents(shipmentId);
  }

  /* ---------------------------------------------------------- pickup */

  async schedulePickup(shipmentId: string, actorId?: string): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (!shipment.providerShipmentId) throw new BadRequestException('Shipment not created on Shiprocket');
    if (!shipment.awbNumber) throw new BadRequestException('Assign an AWB before scheduling pickup');

    const res = await this.sr.generatePickup(Number(shipment.providerShipmentId));
    const scheduledRaw =
      res.response?.pickup_scheduled_date ?? res.response?.pickup_generated_date?.date ?? null;
    const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        pickupScheduledAt: scheduledAt && !Number.isNaN(+scheduledAt) ? scheduledAt : new Date(),
        pickupTokenNumber:
          res.response?.pickup_token_number != null ? String(res.response.pickup_token_number) : null,
        rawStatus: 'PICKUP SCHEDULED',
        lastSyncedAt: new Date(),
      },
    });
    await this.appendOrderEvent(
      shipment.orderId,
      `Pickup scheduled${scheduledRaw ? ` for ${scheduledRaw}` : ''}`,
      actorId,
    );
    return this.withEvents(shipmentId);
  }

  /* ------------------------------------------------- label / invoice */

  async getLabel(shipmentId: string, force = false): Promise<{ url: string }> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (shipment.labelUrl && !force) return { url: shipment.labelUrl };
    if (!shipment.providerShipmentId) throw new BadRequestException('Shipment not created on Shiprocket');
    if (!shipment.awbNumber) throw new BadRequestException('Assign an AWB before generating the label');
    const res = await this.sr.generateLabel(Number(shipment.providerShipmentId));
    if (!res.label_url) throw new ShiprocketError(res.response ?? 'Label not generated', undefined, res);
    await this.prisma.shipment.update({ where: { id: shipmentId }, data: { labelUrl: res.label_url } });
    return { url: res.label_url };
  }

  async getInvoice(shipmentId: string, force = false): Promise<{ url: string }> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (shipment.invoiceUrl && !force) return { url: shipment.invoiceUrl };
    if (!shipment.providerOrderId) throw new BadRequestException('Shipment not created on Shiprocket');
    const res = await this.sr.printInvoice(Number(shipment.providerOrderId));
    if (!res.invoice_url) throw new ShiprocketError('Invoice not generated', undefined, res);
    await this.prisma.shipment.update({ where: { id: shipmentId }, data: { invoiceUrl: res.invoice_url } });
    return { url: res.invoice_url };
  }

  async getManifest(shipmentId: string): Promise<{ url: string }> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (shipment.manifestUrl) return { url: shipment.manifestUrl };
    if (!shipment.providerShipmentId) throw new BadRequestException('Shipment not created on Shiprocket');
    const res = await this.sr.generateManifest(Number(shipment.providerShipmentId));
    if (!res.manifest_url) throw new ShiprocketError('Manifest not generated', undefined, res);
    await this.prisma.shipment.update({ where: { id: shipmentId }, data: { manifestUrl: res.manifest_url } });
    return { url: res.manifest_url };
  }

  /* ---------------------------------------------------------- cancel */

  async cancel(shipmentId: string, actorId?: string): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (shipment.cancelledAt) return this.withEvents(shipmentId);
    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException('A delivered shipment cannot be cancelled');
    }
    try {
      if (shipment.awbNumber) await this.sr.cancelShipmentAwb(shipment.awbNumber);
      if (shipment.providerOrderId) await this.sr.cancelOrder(Number(shipment.providerOrderId));
    } catch (err) {
      // Surface a clear message but still mark locally if Shiprocket says "already cancelled".
      const msg = (err as Error).message.toLowerCase();
      if (!msg.includes('already') && !msg.includes('cancel')) throw err;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          cancelledAt: new Date(),
          status: ShipmentStatus.FAILED,
          rawStatus: 'CANCELED',
          lastSyncedAt: new Date(),
        },
      });
      if (shipment.fulfillmentId) {
        await tx.fulfillment.update({
          where: { id: shipment.fulfillmentId },
          data: { status: FulfillmentStatus.RETURNED },
        });
      }
      await tx.order.update({
        where: { id: shipment.orderId },
        data: {
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          statusHistory: {
            create: { status: OrderStatus.PROCESSING, note: 'Shipment cancelled', createdById: actorId ?? null },
          },
        },
      });
    });
    this.logger.log(`Shipment ${shipmentId} cancelled`);
    return this.withEvents(shipmentId);
  }

  /* --------------------------------------------------- tracking sync */

  async refreshTracking(shipmentId: string): Promise<ShipmentWithEvents> {
    const shipment = await this.getShipmentRow(shipmentId);
    if (!shipment.awbNumber && !shipment.providerShipmentId) {
      throw new BadRequestException('Nothing to track yet');
    }
    const res = shipment.providerShipmentId
      ? await this.sr.trackByShipment(Number(shipment.providerShipmentId))
      : await this.sr.trackByAwb(shipment.awbNumber!);

    const td = res.tracking_data;
    const track = td?.shipment_track?.[0];
    const activities = td?.shipment_track_activities ?? [];
    const currentRaw =
      track?.current_status ?? activities[0]?.['sr-status-label'] ?? activities[0]?.status ?? null;

    await this.applyStatus(shipmentId, {
      srStatus: currentRaw ?? td?.shipment_status ?? null,
      rawStatus: currentRaw,
      courierName: track?.courier_name ?? undefined,
      edd: track?.edd ?? td?.etd ?? undefined,
      deliveredDate: track?.delivered_date ?? undefined,
      events: activities.map((a) => ({
        status: mapShiprocketStatus(a['sr-status'] ?? a['sr-status-label'] ?? a.status),
        message: a.activity ?? a.status ?? null,
        location: a.location ?? null,
        occurredAt: a.date ? new Date(a.date) : new Date(),
      })),
    });
    return this.withEvents(shipmentId);
  }

  private async pollActiveShipments(): Promise<void> {
    if (this.polling || !this.sr.configured) return;
    this.polling = true;
    try {
      const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      const rows = await this.prisma.shipment.findMany({
        where: {
          provider: PROVIDER,
          cancelledAt: null,
          status: { notIn: TERMINAL },
          awbNumber: { not: null },
          createdAt: { gte: since },
        },
        orderBy: { lastSyncedAt: 'asc' },
        take: 40,
        select: { id: true },
      });
      if (rows.length) this.logger.log(`Polling ${rows.length} active shipment(s)`);
      for (const r of rows) {
        try {
          await this.refreshTracking(r.id);
        } catch (err) {
          this.logger.warn(`Poll: shipment ${r.id} → ${(err as Error).message}`);
        }
        await new Promise((res) => setTimeout(res, 600));
      }
    } finally {
      this.polling = false;
    }
  }

  /* ---------------------------------------------------------- webhook */

  verifyWebhook(headers: Record<string, string | string[] | undefined>): boolean {
    const expected = env.SHIPROCKET_WEBHOOK_TOKEN;
    if (!expected) return false;
    const got = pickHeader(headers, 'x-api-key') ?? pickHeader(headers, 'x-shiprocket-key');
    if (!got) return false;
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async handleWebhook(body: SrWebhookBody): Promise<{ handled: boolean; reason?: string }> {
    const awb = body.awb != null ? String(body.awb) : null;
    const providerShipmentId = body.sr_order_id != null ? String(body.sr_order_id) : null;
    const orderNumber = body.channel_order_id ?? body.order_id ?? null;

    const shipment = await this.prisma.shipment.findFirst({
      where: {
        provider: PROVIDER,
        OR: [
          ...(awb ? [{ awbNumber: awb }] : []),
          ...(providerShipmentId ? [{ providerShipmentId }] : []),
          ...(orderNumber ? [{ order: { orderNumber } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment) return { handled: false, reason: 'shipment not found' };

    const raw = body.current_status ?? body.shipment_status ?? null;
    const scans = body.scans ?? [];
    await this.applyStatus(shipment.id, {
      srStatus: raw ?? body.current_status_id ?? body.shipment_status_id ?? null,
      rawStatus: raw,
      courierName: body.courier_name ?? undefined,
      edd: body.etd ?? undefined,
      events: scans.map((sc) => ({
        status: mapShiprocketStatus(sc['sr-status'] ?? sc['sr-status-label'] ?? sc.activity),
        message: sc.activity ?? null,
        location: sc.location ?? null,
        occurredAt: sc.date ? new Date(sc.date) : new Date(),
      })),
      occurredAt: body.current_timestamp ? new Date(body.current_timestamp) : undefined,
    });
    return { handled: true };
  }

  /* ------------------------------------------------- auto-create hook */

  /** Called (best-effort, non-blocking) from OrdersService when an order confirms. */
  async autoCreateForOrder(orderId: string): Promise<void> {
    if (!this.sr.configured || !env.SHIPROCKET_AUTO_CREATE) return;
    try {
      await this.createShipment(orderId, {
        assignAwb: env.SHIPROCKET_AUTO_ASSIGN_AWB,
      });
    } catch (err) {
      this.logger.warn(
        `Auto shipment creation failed for order ${orderId}: ${(err as Error).message}`,
      );
    }
  }

  /* ------------------------------------------------------------- reads */

  async getShipmentForAdmin(shipmentId: string) {
    return this.withEvents(shipmentId);
  }

  async listForOrder(orderId: string) {
    return this.prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } },
    });
  }

  /* ---------------------------------------------------------- internals */

  private async applyStatus(
    shipmentId: string,
    input: {
      srStatus: string | number | null;
      rawStatus?: string | null;
      courierName?: string;
      edd?: string | null;
      deliveredDate?: string | null;
      occurredAt?: Date;
      events?: Array<{
        status: ShipmentStatus;
        message: string | null;
        location: string | null;
        occurredAt: Date;
      }>;
    },
  ): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { trackingEvents: true, order: { select: { id: true, status: true, orderNumber: true } } },
    });
    if (!shipment) return;

    const nextStatus = mapShiprocketStatus(input.srStatus);
    const edd = input.edd ? new Date(input.edd) : null;
    const deliveredAt =
      nextStatus === ShipmentStatus.DELIVERED
        ? input.deliveredDate
          ? new Date(input.deliveredDate)
          : (input.occurredAt ?? new Date())
        : null;
    const inMotion: ShipmentStatus[] = [
      ShipmentStatus.PICKED_UP,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.OUT_FOR_DELIVERY,
    ];
    const shippedAt =
      !shipment.shippedAt && inMotion.includes(nextStatus)
        ? (input.occurredAt ?? new Date())
        : null;

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: nextStatus,
        rawStatus: input.rawStatus ?? shipment.rawStatus,
        courierName: input.courierName ?? shipment.courierName,
        estimatedDelivery: edd && !Number.isNaN(+edd) ? edd : shipment.estimatedDelivery,
        ...(shippedAt ? { shippedAt } : {}),
        ...(deliveredAt && !Number.isNaN(+deliveredAt) ? { deliveredAt } : {}),
        lastSyncedAt: new Date(),
      },
    });

    // Append new tracking events (dedupe on occurredAt + message).
    const seen = new Set(
      shipment.trackingEvents.map((e) => `${e.occurredAt.getTime()}::${e.message ?? ''}`),
    );
    const fresh = (input.events ?? []).filter((e) => {
      if (Number.isNaN(+e.occurredAt)) return false;
      const key = `${e.occurredAt.getTime()}::${e.message ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      await this.prisma.shipmentEvent.createMany({
        data: fresh.map((e) => ({
          shipmentId,
          status: e.status,
          message: e.message,
          location: e.location,
          occurredAt: e.occurredAt,
        })),
      });
    }

    // Advance the order forward-only.
    const targetOrderStatus = orderStatusForShipment(nextStatus, input.rawStatus);
    if (
      targetOrderStatus &&
      orderRank(targetOrderStatus) > orderRank(shipment.order.status) &&
      shipment.order.status !== OrderStatus.CANCELLED
    ) {
      await this.prisma.order.update({
        where: { id: shipment.order.id },
        data: {
          status: targetOrderStatus,
          ...(targetOrderStatus === OrderStatus.DELIVERED
            ? { deliveredAt: deliveredAt ?? new Date() }
            : {}),
          statusHistory: {
            create: {
              status: targetOrderStatus,
              note: `Shipment ${SHIPMENT_STATUS_LABEL[nextStatus]}${input.rawStatus ? ` (${input.rawStatus})` : ''}`,
            },
          },
        },
      });
      this.logger.log(
        `Order ${shipment.order.orderNumber}: ${shipment.order.status} → ${targetOrderStatus} (shipment ${nextStatus})`,
      );
    }
  }

  private buildOrderPayload(
    order: OrderForShipping,
    ctx: {
      pickupLocation: string;
      weightKg: number;
      dims: { length: number; breadth: number; height: number };
    },
  ): SrCreateOrderPayload {
    const a = this.addr(order);
    const fullName = String(a.fullName ?? 'Customer').trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(' ') || '.';
    const phone = String(a.phone ?? order.guestPhone ?? '').replace(/\D/g, '').slice(-10);
    const email =
      order.user?.email || order.guestEmail || `${order.orderNumber.toLowerCase()}@velorhouse.in`;

    return {
      order_id: order.orderNumber,
      order_date: formatSrDate(order.placedAt),
      pickup_location: ctx.pickupLocation,
      ...(env.SHIPROCKET_CHANNEL_ID ? { channel_id: env.SHIPROCKET_CHANNEL_ID } : {}),
      comment: order.customerNote ?? undefined,
      billing_customer_name: firstName || 'Customer',
      billing_last_name: lastName,
      billing_address: String(a.line1 ?? '').slice(0, 250) || 'Address on file',
      billing_address_2: [a.line2, a.landmark].filter(Boolean).join(', ').slice(0, 250) || undefined,
      billing_city: String(a.city ?? '').slice(0, 80) || 'NA',
      billing_pincode: String(a.pincode ?? ''),
      billing_state: String(a.state ?? '').slice(0, 80) || 'NA',
      billing_country: 'India',
      billing_email: email,
      billing_phone: phone,
      shipping_is_billing: true,
      order_items: order.items.map((i) => ({
        name: i.productName.slice(0, 250),
        sku: i.sku || i.id,
        units: i.quantity,
        selling_price: Math.max(0, Math.round(toNumber(i.unitPrice))),
        discount: Math.max(0, Math.round(toNumber(i.discountTotal))),
        tax: Math.max(0, Math.round(toNumber(i.taxTotal))),
      })),
      payment_method: this.isCod(order) ? 'COD' : 'Prepaid',
      shipping_charges: Math.round(toNumber(order.shippingTotal)),
      total_discount: Math.round(toNumber(order.discountTotal)),
      sub_total: Math.round(toNumber(order.grandTotal)),
      length: ctx.dims.length,
      breadth: ctx.dims.breadth,
      height: ctx.dims.height,
      weight: Number(ctx.weightKg.toFixed(2)),
    };
  }

  private async loadOrder(orderId: string): Promise<OrderForShipping> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        user: { select: { email: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async getShipmentRow(shipmentId: string): Promise<Shipment> {
    const s = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Shipment not found');
    return s;
  }

  private withEvents(shipmentId: string): Promise<ShipmentWithEvents> {
    return this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } },
    });
  }

  private async appendOrderEvent(orderId: string, note: string, actorId?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) return;
    await this.prisma.orderStatusEvent.create({
      data: { orderId, status: order.status, note, createdById: actorId ?? null },
    });
  }

  private isCod(order: OrderForShipping): boolean {
    return order.payments[0]?.method === 'COD' || order.payments.some((p) => p.method === 'COD');
  }

  private addr(order: { shippingAddress: Prisma.JsonValue }): Record<string, unknown> {
    return (order.shippingAddress ?? {}) as Record<string, unknown>;
  }

  private async parcelWeightKg(order: OrderForShipping): Promise<number> {
    const variantIds = order.items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
    let grams = 0;
    if (variantIds.length) {
      const variants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, weightGrams: true, product: { select: { weightGrams: true } } },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));
      for (const item of order.items) {
        const v = item.variantId ? byId.get(item.variantId) : undefined;
        const per =
          v?.weightGrams ?? v?.product?.weightGrams ?? env.SHIPROCKET_DEFAULT_WEIGHT_KG * 1000;
        grams += per * item.quantity;
      }
    } else {
      grams = env.SHIPROCKET_DEFAULT_WEIGHT_KG * 1000 * order.items.length;
    }
    return Math.max(0.1, Math.round(grams) / 1000);
  }

  private async pickupPincode(): Promise<string> {
    const loc = await this.resolvePickupLocation();
    const list = await this.sr.listPickupLocations().catch(() => null);
    const match = list?.data?.shipping_address?.find((a) => a.pickup_location === loc);
    if (match?.pin_code && /^\d{6}$/.test(String(match.pin_code))) return String(match.pin_code);
    // Fall back to the configured warehouse address, then a metro default.
    const wh = await this.prisma.warehouse.findFirst({ orderBy: { priority: 'desc' } });
    const whPin = (wh?.addressJson as { pincode?: string } | null)?.pincode;
    if (whPin && /^\d{6}$/.test(whPin)) return whPin;
    return '110001';
  }

  private cachedPickup: string | null = null;
  private async resolvePickupLocation(): Promise<string> {
    if (env.SHIPROCKET_PICKUP_LOCATION) return env.SHIPROCKET_PICKUP_LOCATION;
    if (this.cachedPickup) return this.cachedPickup;
    const list = await this.sr.listPickupLocations();
    const first = list.data?.shipping_address?.[0]?.pickup_location;
    if (!first) {
      throw new BadRequestException(
        'No pickup location configured. Add one in the Shiprocket panel and set SHIPROCKET_PICKUP_LOCATION.',
      );
    }
    this.cachedPickup = first;
    return first;
  }
}

/* -------------------------------------------------------------------------- */

type OrderForShipping = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payments: true;
    user: { select: { email: true } };
  };
}>;

function formatSrDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function pickHeader(
  h: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const v = h[name] ?? h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}
