import { describe, expect, it } from 'vitest';
import { OrderStatus, ShipmentStatus } from '@slay/db';
import { mapShiprocketStatus, orderRank, orderStatusForShipment } from './status-map.js';

describe('mapShiprocketStatus', () => {
  it.each([
    ['DELIVERED', ShipmentStatus.DELIVERED],
    ['Delivered', ShipmentStatus.DELIVERED],
    ['OUT FOR DELIVERY', ShipmentStatus.OUT_FOR_DELIVERY],
    ['IN TRANSIT', ShipmentStatus.IN_TRANSIT],
    ['In-Transit', ShipmentStatus.IN_TRANSIT],
    ['PICKED UP', ShipmentStatus.PICKED_UP],
    ['RTO DELIVERED', ShipmentStatus.RTO],
    ['RTO INITIATED', ShipmentStatus.RTO],
    ['CANCELED', ShipmentStatus.FAILED],
    ['CANCELLED', ShipmentStatus.FAILED],
    ['LOST', ShipmentStatus.FAILED],
    ['UNDELIVERED', ShipmentStatus.FAILED],
    ['PICKUP SCHEDULED', ShipmentStatus.LABEL_CREATED],
    ['NEW', ShipmentStatus.LABEL_CREATED],
    ['', ShipmentStatus.LABEL_CREATED],
    [7, ShipmentStatus.DELIVERED],
    [6, ShipmentStatus.IN_TRANSIT],
    [null, ShipmentStatus.LABEL_CREATED],
  ])('%s -> %s', (input, expected) => {
    expect(mapShiprocketStatus(input as string | number | null)).toBe(expected);
  });
});

describe('orderStatusForShipment', () => {
  it('delivered shipment delivers the order', () => {
    expect(orderStatusForShipment(ShipmentStatus.DELIVERED)).toBe(OrderStatus.DELIVERED);
  });
  it('picked up / in transit ship the order', () => {
    expect(orderStatusForShipment(ShipmentStatus.PICKED_UP)).toBe(OrderStatus.SHIPPED);
    expect(orderStatusForShipment(ShipmentStatus.IN_TRANSIT)).toBe(OrderStatus.SHIPPED);
  });
  it('pickup-scheduled label packs the order', () => {
    expect(orderStatusForShipment(ShipmentStatus.LABEL_CREATED, 'PICKUP SCHEDULED')).toBe(
      OrderStatus.PACKED,
    );
  });
  it('bare label -> processing', () => {
    expect(orderStatusForShipment(ShipmentStatus.LABEL_CREATED, 'NEW')).toBe(OrderStatus.PROCESSING);
  });
  it('failed shipment does not change the order', () => {
    expect(orderStatusForShipment(ShipmentStatus.FAILED)).toBeNull();
  });
  it('RTO returns the order', () => {
    expect(orderStatusForShipment(ShipmentStatus.RTO)).toBe(OrderStatus.RETURNED);
  });
});

describe('orderRank (forward-only guard)', () => {
  it('orders the lifecycle', () => {
    expect(orderRank('PENDING')).toBeLessThan(orderRank('CONFIRMED'));
    expect(orderRank('SHIPPED')).toBeLessThan(orderRank('DELIVERED'));
    expect(orderRank('DELIVERED')).toBeGreaterThan(orderRank('PROCESSING'));
  });
  it('unknown status ranks lowest', () => {
    expect(orderRank('WAT')).toBe(0);
  });
});
