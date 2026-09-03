import { OrderStatus, ShipmentStatus } from '@slay/db';

/**
 * Map a Shiprocket status string (from a webhook or a tracking poll) onto our
 * internal ShipmentStatus enum. Shiprocket sends free-form upper-case labels
 * ("PICKUP SCHEDULED", "IN TRANSIT", "RTO DELIVERED", "CANCELED", …) and,
 * sometimes, a numeric `sr-status` / `shipment_status_id`.
 */
export function mapShiprocketStatus(raw: string | number | null | undefined): ShipmentStatus {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!s) return ShipmentStatus.LABEL_CREATED;

  // Numeric Shiprocket status codes (partial, best-effort).
  const code = Number(s);
  if (Number.isFinite(code)) {
    if ([7].includes(code)) return ShipmentStatus.DELIVERED;
    if ([6, 17, 18, 42, 43].includes(code)) return ShipmentStatus.IN_TRANSIT;
    if ([9].includes(code)) return ShipmentStatus.RTO;
    if ([15, 16].includes(code)) return ShipmentStatus.RTO;
    if ([19].includes(code)) return ShipmentStatus.OUT_FOR_DELIVERY;
    if ([8].includes(code)) return ShipmentStatus.FAILED;
    if ([4, 5].includes(code)) return ShipmentStatus.PICKED_UP;
    if ([1, 2, 3].includes(code)) return ShipmentStatus.LABEL_CREATED;
  }

  if (s.includes('UNDELIVERED') || s.includes('NOT DELIVERED') || s.includes('UNDELIVERABLE')) {
    return ShipmentStatus.FAILED;
  }
  if (s.includes('RTO')) return ShipmentStatus.RTO;
  if (s.includes('OUT FOR DELIVERY') || s.includes('OUT_FOR_DELIVERY')) {
    return ShipmentStatus.OUT_FOR_DELIVERY;
  }
  if (s.includes('DELIVERED')) return ShipmentStatus.DELIVERED;
  if (
    s.includes('IN TRANSIT') ||
    s.includes('IN-TRANSIT') ||
    s.includes('TRANSIT') ||
    s.includes('REACHED') ||
    s.includes('MISROUTED') ||
    s.includes('SHIPPED')
  ) {
    return ShipmentStatus.IN_TRANSIT;
  }
  if (s.includes('PICKED UP') || s.includes('PICKED_UP') || s.includes('PICKUP COMPLETE')) {
    return ShipmentStatus.PICKED_UP;
  }
  if (
    s.includes('CANCEL') ||
    s.includes('LOST') ||
    s.includes('DAMAGED') ||
    s.includes('UNDELIVERED') ||
    s.includes('EXCEPTION') ||
    s.includes('FAILED')
  ) {
    return ShipmentStatus.FAILED;
  }
  // "NEW", "INVOICED", "READY TO SHIP", "PICKUP SCHEDULED", "PICKUP GENERATED",
  // "PICKUP QUEUED", "AWB ASSIGNED", "LABEL GENERATED", "MANIFEST GENERATED" …
  return ShipmentStatus.LABEL_CREATED;
}

/**
 * Given a shipment status, the order status it should move *forward* to.
 * Returns null when the order status should not change. Never moves an order
 * backwards — the caller enforces that with `ORDER_RANK`.
 */
export function orderStatusForShipment(
  st: ShipmentStatus,
  rawStatus?: string | null,
): OrderStatus | null {
  const raw = String(rawStatus ?? '').toUpperCase();
  switch (st) {
    case ShipmentStatus.LABEL_CREATED:
      // "PICKUP SCHEDULED"/"READY TO SHIP" → the parcel is packed & waiting.
      if (raw.includes('PICKUP') || raw.includes('READY TO SHIP') || raw.includes('MANIFEST')) {
        return OrderStatus.PACKED;
      }
      return OrderStatus.PROCESSING;
    case ShipmentStatus.PICKED_UP:
    case ShipmentStatus.IN_TRANSIT:
      return OrderStatus.SHIPPED;
    case ShipmentStatus.OUT_FOR_DELIVERY:
      return OrderStatus.OUT_FOR_DELIVERY;
    case ShipmentStatus.DELIVERED:
      return OrderStatus.DELIVERED;
    case ShipmentStatus.RTO:
      return OrderStatus.RETURNED;
    case ShipmentStatus.FAILED:
      return null;
    default:
      return null;
  }
}

/** Forward-only ordering of OrderStatus for the shipping-driven transitions. */
const ORDER_RANK: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PROCESSING: 2,
  PACKED: 3,
  SHIPPED: 4,
  OUT_FOR_DELIVERY: 5,
  DELIVERED: 6,
  RETURNED: 6,
  CANCELLED: 6,
  REFUNDED: 7,
};

/** Rank of an order status for forward-only comparisons (unknown → 0). */
export function orderRank(status: OrderStatus | string): number {
  return ORDER_RANK[status] ?? 0;
}

/** Human label for a shipment status (customer + admin UI share this). */
export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  LABEL_CREATED: 'Ready to ship',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Exception',
  RTO: 'Return to origin',
};
