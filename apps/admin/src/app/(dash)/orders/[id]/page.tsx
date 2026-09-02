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
}

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiFetch<Order>(`/admin/orders/${id}`)
      .then((o) => {
        setOrder(o);
        setNextStatus(o.status);
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  useEffect(load, [load]);

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
