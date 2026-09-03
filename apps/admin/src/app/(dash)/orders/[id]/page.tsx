'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, money } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Select } from '@/components/form';

const STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'REFUNDED',
];

const SHIPMENT_LABEL: Record<string, string> = {
  LABEL_CREATED: 'Ready to ship',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Exception',
  RTO: 'Return to origin',
};

interface TrackingEvent {
  status: string;
  message: string | null;
  location: string | null;
  occurredAt: string;
}

interface Shipment {
  id: string;
  provider: string;
  status: string;
  rawStatus: string | null;
  awbNumber: string | null;
  courierName: string | null;
  courierId: number | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  invoiceUrl: string | null;
  manifestUrl: string | null;
  providerOrderId: string | null;
  providerShipmentId: string | null;
  pickupLocation: string | null;
  pickupScheduledAt: string | null;
  pickupTokenNumber: string | null;
  estimatedDelivery: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  weightGrams: number | null;
  freightCharge: string | null;
  lastSyncedAt: string | null;
  trackingEvents: TrackingEvent[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  itemsSubtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  guestEmail: string | null;
  guestPhone: string | null;
  customerNote: string | null;
  placedAt: string;
  shippingAddress: Record<string, string | null>;
  user: { email: string | null; firstName: string | null; lastName: string | null } | null;
  items: {
    id: string;
    productName: string;
    variantLabel: string | null;
    sku: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
  payments: { method: string; status: string; gateway: string | null; amount: string; createdAt: string }[];
  statusHistory: { status: string; note: string | null; createdAt: string }[];
  shipments?: Shipment[];
}

interface Courier {
  courierId: number;
  name: string;
  rate: number;
  etd: string | null;
  rating: number | null;
  codAvailable: boolean;
}

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [srConfigured, setSrConfigured] = useState<boolean | null>(null);

  const load = useCallback(() => {
    apiFetch<Order>(`/admin/orders/${id}`)
      .then((o) => {
        setOrder(o);
        setNextStatus(o.status);
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    apiFetch<{ configured: boolean }>('/admin/shipping/status')
      .then((s) => setSrConfigured(s.configured))
      .catch(() => setSrConfigured(false));
  }, []);

  async function updateStatus() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, note: note || undefined }),
      });
      setNote('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!order) return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;

  const customer = order.user?.email ?? order.guestEmail ?? 'Guest';
  const shipment = order.shipments?.find((s) => !s.cancelledAt) ?? order.shipments?.[0] ?? null;

  return (
    <>
      <div className="mb-4">
        <Link href="/orders" className="text-sm text-[var(--color-brand)]">
          ← All orders
        </Link>
      </div>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${customer} · ${new Date(order.placedAt).toLocaleString('en-IN')}`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Items">
            <table className="w-full text-sm">
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2">
                      <p className="font-medium">{i.productName}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {i.variantLabel ? `${i.variantLabel} · ` : ''}
                        {i.sku}
                      </p>
                    </td>
                    <td className="py-2 text-right">
                      {money(i.unitPrice, order.currency)} × {i.quantity}
                    </td>
                    <td className="py-2 pl-4 text-right font-medium">
                      {money(i.lineTotal, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 space-y-1 border-t border-[var(--color-line)] pt-3 text-sm">
              <Row l="Subtotal" v={money(order.itemsSubtotal, order.currency)} />
              {Number(order.discountTotal) > 0 && (
                <Row l="Discount" v={`− ${money(order.discountTotal, order.currency)}`} />
              )}
              <Row l="Shipping" v={money(order.shippingTotal, order.currency)} />
              <Row l="Tax (incl.)" v={money(order.taxTotal, order.currency)} />
              <Row l="Total" v={money(order.grandTotal, order.currency)} bold />
            </dl>
          </Card>

          <ShipmentPanel
            orderId={order.id}
            shipment={shipment}
            srConfigured={srConfigured}
            onChange={load}
          />

          <Card title="Timeline">
            <ol className="space-y-2 text-sm">
              {order.statusHistory.map((e, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="text-[var(--color-muted)]">
                    {new Date(e.createdAt).toLocaleString('en-IN')}
                  </span>
                  <span>
                    <span className="font-medium">{e.status}</span>
                    {e.note ? ` — ${e.note}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <div className="space-y-1 text-sm">
              <p>
                Order: <span className="font-medium">{order.status}</span>
              </p>
              <p>
                Payment: <span className="font-medium">{order.paymentStatus}</span>
              </p>
              <p>
                Fulfilment: <span className="font-medium">{order.fulfillmentStatus}</span>
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
              />
              <Button onClick={updateStatus} disabled={saving || nextStatus === order.status}>
                {saving ? 'Updating…' : 'Update status'}
              </Button>
            </div>
          </Card>

          <Card title="Payments">
            <ul className="space-y-2 text-sm">
              {order.payments.map((p, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>
                    {p.method}
                    <span className="block text-xs text-[var(--color-muted)]">
                      {p.gateway ?? '—'} · {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </span>
                  <span className="font-medium">{p.status}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Shipping address">
            <address className="text-sm not-italic text-[var(--color-muted)]">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {order.shippingAddress.city}
              {order.shippingAddress.district &&
              order.shippingAddress.district !== order.shippingAddress.city
                ? ` (${order.shippingAddress.district})`
                : ''}
              , {order.shippingAddress.state} {order.shippingAddress.pincode}
              <br />
              {order.shippingAddress.phone}
            </address>
            {order.customerNote && (
              <p className="mt-3 text-xs">
                <span className="font-medium">Note:</span> {order.customerNote}
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <dt>{l}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/* ---------------------------------------------------- shipment / fulfilment */

function ShipmentPanel({
  orderId,
  shipment,
  srConfigured,
  onChange,
}: {
  orderId: string;
  shipment: Shipment | null;
  srConfigured: boolean | null;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [courierId, setCourierId] = useState<string>('');
  const [recommended, setRecommended] = useState<number | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loadCouriers = () =>
    run('couriers', async () => {
      const res = await apiFetch<{ couriers: Courier[]; recommendedCourierId: number | null }>(
        `/admin/orders/${orderId}/serviceability`,
      );
      setCouriers(res.couriers);
      setRecommended(res.recommendedCourierId);
      if (res.recommendedCourierId) setCourierId(String(res.recommendedCourierId));
    });

  const openUrl = (u: string | null | undefined) => {
    if (u) window.open(u, '_blank', 'noopener');
  };

  if (srConfigured === false) {
    return (
      <Card title="Shipment">
        <p className="text-sm text-[var(--color-muted)]">
          Shiprocket is not configured on the server. Set <code>SHIPROCKET_EMAIL</code> /{' '}
          <code>SHIPROCKET_PASSWORD</code> (and <code>SHIPROCKET_PICKUP_LOCATION</code>) in the API
          environment to enable shipping automation.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Shipment & fulfilment">
      {err && <p className="mb-3 text-sm text-[var(--color-bad)]">{err}</p>}

      {!shipment && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-muted)]">
            No shipment yet. Create one on Shiprocket — an AWB is assigned automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={loadCouriers} disabled={busy !== null}>
              {busy === 'couriers' ? 'Checking…' : 'Check couriers'}
            </Button>
            {couriers && (
              <Select
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className="max-w-[240px]"
              >
                <option value="">Auto (recommended)</option>
                {couriers.map((c) => (
                  <option key={c.courierId} value={c.courierId}>
                    {c.name} · ₹{c.rate} · {c.etd ?? '—'}
                    {c.courierId === recommended ? ' ★' : ''}
                  </option>
                ))}
              </Select>
            )}
            <Button
              onClick={() =>
                run('create', () =>
                  apiFetch(`/admin/orders/${orderId}/shipment`, {
                    method: 'POST',
                    body: JSON.stringify(courierId ? { courierId: Number(courierId) } : {}),
                  }),
                )
              }
              disabled={busy !== null}
            >
              {busy === 'create' ? 'Creating…' : 'Create shipment'}
            </Button>
          </div>
        </div>
      )}

      {shipment && (
        <div className="space-y-4 text-sm">
          <dl className="space-y-1">
            <Row l="Status" v={`${SHIPMENT_LABEL[shipment.status] ?? shipment.status}${shipment.rawStatus ? ` · ${shipment.rawStatus}` : ''}`} />
            <Row l="Courier" v={shipment.courierName ?? '—'} />
            <Row l="AWB" v={shipment.awbNumber ?? 'Not assigned'} />
            <Row l="Shiprocket order" v={shipment.providerOrderId ?? '—'} />
            <Row l="Pickup" v={shipment.pickupLocation ?? '—'} />
            {shipment.pickupScheduledAt && (
              <Row
                l="Pickup scheduled"
                v={`${new Date(shipment.pickupScheduledAt).toLocaleDateString('en-IN')}${
                  shipment.pickupTokenNumber ? ` (token ${shipment.pickupTokenNumber})` : ''
                }`}
              />
            )}
            {shipment.estimatedDelivery && (
              <Row l="Est. delivery" v={new Date(shipment.estimatedDelivery).toLocaleDateString('en-IN')} />
            )}
            {shipment.weightGrams != null && <Row l="Weight" v={`${(shipment.weightGrams / 1000).toFixed(2)} kg`} />}
            {shipment.lastSyncedAt && (
              <Row l="Last synced" v={new Date(shipment.lastSyncedAt).toLocaleString('en-IN')} />
            )}
            {shipment.cancelledAt && <Row l="Cancelled" v={new Date(shipment.cancelledAt).toLocaleString('en-IN')} />}
          </dl>

          {!shipment.cancelledAt && (
            <div className="flex flex-wrap gap-2">
              {!shipment.awbNumber && (
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => run('awb', () => apiFetch(`/admin/shipments/${shipment.id}/awb`, { method: 'POST', body: '{}' }))}
                >
                  {busy === 'awb' ? 'Assigning…' : 'Generate AWB'}
                </Button>
              )}
              {shipment.awbNumber && !shipment.pickupScheduledAt && (
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => run('pickup', () => apiFetch(`/admin/shipments/${shipment.id}/pickup`, { method: 'POST', body: '{}' }))}
                >
                  {busy === 'pickup' ? 'Scheduling…' : 'Schedule pickup'}
                </Button>
              )}
              {shipment.awbNumber && (
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() =>
                    run('label', async () => {
                      const r = await apiFetch<{ url: string }>(`/admin/shipments/${shipment.id}/label`, { method: 'POST', body: '{}' });
                      openUrl(r.url);
                    })
                  }
                >
                  {busy === 'label' ? '…' : 'Download label'}
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() =>
                  run('invoice', async () => {
                    const r = await apiFetch<{ url: string }>(`/admin/shipments/${shipment.id}/invoice`, { method: 'POST', body: '{}' });
                    openUrl(r.url);
                  })
                }
              >
                {busy === 'invoice' ? '…' : 'Invoice'}
              </Button>
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() => run('track', () => apiFetch(`/admin/shipments/${shipment.id}/track`))}
              >
                {busy === 'track' ? 'Refreshing…' : 'Refresh tracking'}
              </Button>
              {shipment.trackingUrl && (
                <Button variant="ghost" onClick={() => openUrl(shipment.trackingUrl)}>
                  Open tracking
                </Button>
              )}
              {shipment.status !== 'DELIVERED' && (
                <Button
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() => {
                    if (confirm('Cancel this shipment on Shiprocket?')) {
                      run('cancel', () => apiFetch(`/admin/shipments/${shipment.id}/cancel`, { method: 'POST', body: '{}' }));
                    }
                  }}
                >
                  {busy === 'cancel' ? 'Cancelling…' : 'Cancel shipment'}
                </Button>
              )}
            </div>
          )}

          {shipment.trackingEvents.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-muted)]">Tracking</p>
              <ol className="space-y-1.5">
                {shipment.trackingEvents.map((e, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="text-[var(--color-muted)]">
                      {new Date(e.occurredAt).toLocaleString('en-IN')}
                    </span>
                    <span>
                      {e.message ?? SHIPMENT_LABEL[e.status] ?? e.status}
                      {e.location ? ` · ${e.location}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
