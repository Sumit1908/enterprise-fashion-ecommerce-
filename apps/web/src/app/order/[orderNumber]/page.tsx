'use client';

import { Suspense, use, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { storefront, inr, ApiError, type OrderView } from '@/lib/storefront';
import { useCart } from '@/lib/cart-context';

export default function OrderPageWrapper({ params }: { params: Promise<{ orderNumber: string }> }) {
  return (
    <Suspense
      fallback={<div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading order…</div>}
    >
      <OrderPage params={params} />
    </Suspense>
  );
}

const STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const STEP_LABEL: Record<string, string> = {
  PENDING: 'Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

const SHIPMENT_LABEL: Record<string, string> = {
  LABEL_CREATED: 'Ready to ship',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Delivery exception',
  RTO: 'Returned to sender',
};

function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const search = useSearchParams();
  const router = useRouter();
  const { refresh } = useCart();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const emailParam = search.get('email') ?? undefined;

  const load = useCallback(
    async (withEmail?: string) => {
      try {
        setOrder(await storefront.getOrder(orderNumber, withEmail));
        setNeedEmail(false);
        setError(null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) setNeedEmail(true);
        else setError(e instanceof ApiError ? e.message : 'Could not load this order.');
      }
    },
    [orderNumber],
  );

  useEffect(() => {
    // The order-confirmation redirect / emailed link carries ?email=…; the
    // just-placed guest also has a cart token that proves ownership.
    void load(emailParam);
    void refresh();
  }, [load, refresh, emailParam]);

  if (needEmail) {
    return (
      <div className="container-wide py-20">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="font-display text-2xl font-semibold">Track your order</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Enter the email you used at checkout to view order {orderNumber}.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(email);
            }}
            className="mt-6 flex gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-md border border-[var(--color-sand)] px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white">
              View
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="container-wide py-20 text-center text-sm text-[var(--color-sale)]">{error}</div>;
  }
  if (!order) {
    return <div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading order…</div>;
  }

  const paymentFailed = order.paymentStatus === 'FAILED' || search.get('payment') === 'failed';
  const paymentPending =
    order.status === 'PENDING' && order.paymentStatus !== 'PAID' && order.payment?.method !== 'COD';
  const currentStepIdx = STEPS.indexOf(order.status);

  async function retryCod() {
    setRetrying(true);
    try {
      await storefront.retryPayment({ orderNumber, email: emailParam, paymentMethod: 'COD' });
      await load(emailParam);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="container-wide max-w-3xl py-10">
      {order.status !== 'PENDING' || order.payment?.method === 'COD' ? (
        <div className="rounded-xl bg-[var(--color-bone)] p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">Thank you</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Order {order.orderNumber} confirmed</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {order.payment?.method === 'COD'
              ? 'Pay in cash when your order is delivered.'
              : 'We&apos;ve emailed your receipt. We&apos;ll let you know when it ships.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-sale)] p-6 text-center">
          <h1 className="font-display text-2xl font-semibold">
            {paymentFailed ? 'Payment not completed' : 'Payment pending'}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Order {order.orderNumber} is reserved. Complete payment to confirm it.
          </p>
          {paymentPending && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() =>
                  router.push(
                    `/checkout/pay/${order.orderNumber}${emailParam ? `?email=${encodeURIComponent(emailParam)}` : ''}`,
                  )
                }
                className="rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-semibold text-white"
              >
                Retry payment
              </button>
              <button onClick={retryCod} disabled={retrying} className="text-xs underline">
                {retrying ? 'Switching…' : 'Switch to Cash on Delivery'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* progress tracker */}
      {currentStepIdx >= 1 && order.status !== 'CANCELLED' && (
        <div className="mt-8 overflow-x-auto">
          <ol className="flex min-w-max gap-2">
            {STEPS.slice(1).map((step, i) => {
              const idx = i + 1;
              const done = currentStepIdx >= idx;
              return (
                <li key={step} className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                        done ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-sand)] text-[var(--color-ink-soft)]'
                      }`}
                    >
                      {done ? '✓' : idx}
                    </span>
                    <span className="mt-1 whitespace-nowrap text-[10px] text-[var(--color-ink-soft)]">
                      {STEP_LABEL[step]}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span className={`h-px w-8 ${done ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-sand)]'}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {order.shipments.length > 0 && (
        <section className="mt-8 rounded-xl border border-[var(--color-sand)] p-5">
          <h2 className="text-sm font-semibold">Shipment</h2>
          {order.shipments.map((s, si) => (
            <div key={si} className="mt-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium">
                  {s.rawStatus && SHIPMENT_LABEL[s.status] !== s.rawStatus
                    ? s.rawStatus
                    : (SHIPMENT_LABEL[s.status] ?? s.status)}
                </span>
                {s.courierName && <span className="text-[var(--color-ink-soft)]">{s.courierName}</span>}
                {s.awbNumber && (
                  <span className="text-[var(--color-ink-soft)]">AWB {s.awbNumber}</span>
                )}
                {s.estimatedDelivery && (
                  <span className="text-[var(--color-ink-soft)]">
                    Est. {new Date(s.estimatedDelivery).toLocaleDateString('en-IN')}
                  </span>
                )}
              </div>
              {s.trackingUrl && (
                <a
                  href={s.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs font-semibold underline"
                >
                  Track with courier →
                </a>
              )}
              {s.events.length > 0 && (
                <ol className="mt-3 space-y-1.5 border-t border-[var(--color-sand)] pt-3">
                  {s.events.map((e, ei) => (
                    <li key={ei} className="flex gap-3 text-xs">
                      <span className="whitespace-nowrap text-[var(--color-ink-soft)]">
                        {new Date(e.at).toLocaleString('en-IN')}
                      </span>
                      <span>
                        {e.message ?? SHIPMENT_LABEL[e.status] ?? e.status}
                        {e.location ? ` · ${e.location}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold">Items</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 text-sm">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-[var(--color-sand)]">
                  {i.imageUrl && <Image src={i.imageUrl} alt={i.productName} fill className="object-cover" sizes="56px" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {i.variantLabel ? `${i.variantLabel} · ` : ''}Qty {i.quantity}
                  </p>
                </div>
                <p className="font-medium">{inr(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold">Summary</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Subtotal" value={inr(order.totals.itemsSubtotal)} />
            {Number(order.totals.discountTotal) > 0 && (
              <Row label="Discount" value={`− ${inr(order.totals.discountTotal)}`} />
            )}
            <Row
              label="Shipping"
              value={Number(order.totals.shippingTotal) === 0 ? 'Free' : inr(order.totals.shippingTotal)}
            />
            <Row label="Tax (incl.)" value={inr(order.totals.taxTotal)} muted />
            <div className="border-t border-[var(--color-sand)] pt-1.5">
              <Row label="Total" value={inr(order.totals.grandTotal)} bold />
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
            Payment: {order.payment?.method} · {order.paymentStatus.toLowerCase()}
          </p>

          <h3 className="mt-5 text-sm font-semibold">Delivery address</h3>
          <address className="mt-2 text-sm not-italic text-[var(--color-ink-soft)]">
            {order.shippingAddress.fullName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
            <br />
            {order.shippingAddress.phone}
          </address>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Order timeline</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {order.timeline.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-[var(--color-ink-soft)]">{new Date(e.at).toLocaleString('en-IN')}</span>
              <span>
                <span className="font-medium">{STEP_LABEL[e.status] ?? e.status}</span>
                {e.note ? ` — ${e.note}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 text-center">
        <Link href="/" className="text-sm underline">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <dt className={muted ? 'text-[var(--color-ink-soft)]' : ''}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
