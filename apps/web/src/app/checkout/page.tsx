'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { storefront, inr, ApiError, type CheckoutSummary } from '@/lib/storefront';

interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}
const EMPTY_ADDR: Address = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { refresh } = useCart();
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState<Address>(EMPTY_ADDR);
  const [shippingRateId, setShippingRateId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [note, setNote] = useState('');

  const [totals, setTotals] = useState<CheckoutSummary['cart']['summary'] | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pincode?: string) => {
    try {
      const data = await storefront.checkoutSummary(pincode);
      setSummary(data);
      setTotals(data.cart.summary);
      setShippingRateId((prev) => prev || data.shippingOptions[0]?.id || '');
      setPaymentMethod((prev) => prev || data.paymentMethods[0]?.method || '');
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load checkout');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-quote when the shipping method / payment method / pincode changes.
  const reQuote = useCallback(async () => {
    if (!shippingRateId) return;
    try {
      const q = await storefront.quote({
        pincode: addr.pincode || undefined,
        shippingRateId,
        paymentMethod,
      });
      setTotals((prev) => ({ ...(prev as CheckoutSummary['cart']['summary']), ...q.totals }));
    } catch {
      /* keep previous totals */
    }
  }, [shippingRateId, paymentMethod, addr.pincode]);

  useEffect(() => {
    void reQuote();
  }, [reQuote]);

  const selectedShipping = useMemo(
    () => summary?.shippingOptions.find((s) => s.id === shippingRateId) ?? null,
    [summary, shippingRateId],
  );

  if (loadError) {
    return (
      <div className="container-wide py-20 text-center">
        <p className="text-sm text-[var(--color-sale)]">{loadError}</p>
        <Link href="/cart" className="mt-4 inline-block text-sm underline">
          Back to cart
        </Link>
      </div>
    );
  }
  if (!summary) {
    return <div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading checkout…</div>;
  }
  if (summary.cart.items.length === 0) {
    return (
      <div className="container-wide py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Your bag is empty</h1>
        <Link href="/" className="mt-6 inline-block rounded-full bg-[var(--color-ink)] px-8 py-4 text-sm font-semibold text-white">
          Continue shopping
        </Link>
      </div>
    );
  }

  const set = (k: keyof Address, v: string) => setAddr((a) => ({ ...a, [k]: v }));

  async function placeOrder() {
    setError(null);
    if (!email || !/.+@.+\..+/.test(email)) return setError('Enter a valid email address.');
    for (const [k, label] of [
      ['fullName', 'full name'],
      ['phone', 'phone'],
      ['line1', 'address'],
      ['city', 'city'],
      ['state', 'state'],
      ['pincode', 'PIN code'],
    ] as const) {
      if (!addr[k].trim()) return setError(`Please enter your ${label}.`);
    }
    if (!shippingRateId) return setError('Choose a delivery option.');
    if (!paymentMethod) return setError('Choose a payment method.');

    setPlacing(true);
    try {
      const { order, payment } = await storefront.placeOrder({
        email,
        phone: addr.phone,
        shippingAddress: {
          fullName: addr.fullName,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2 || undefined,
          landmark: addr.landmark || undefined,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
        },
        shippingRateId,
        paymentMethod,
        customerNote: note || undefined,
      });

      await refresh();
      const orderUrl = `/order/${order.orderNumber}?email=${encodeURIComponent(email)}`;

      if (!payment.requiresClientAction) {
        router.push(orderUrl);
        return;
      }
      if (payment.provider === 'mock' && payment.clientConfig?.payUrl) {
        router.push(`${String(payment.clientConfig.payUrl)}?email=${encodeURIComponent(email)}`);
        return;
      }
      if (payment.provider === 'razorpay') {
        await payWithRazorpay(
          order.orderNumber,
          payment,
          { email, contact: addr.phone, name: addr.fullName },
          router,
        );
        return;
      }
      router.push(orderUrl);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? typeof e.body === 'object' && e.body && 'message' in e.body
            ? String((e.body as { message: unknown }).message)
            : e.message
          : 'Could not place your order.',
      );
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="container-wide py-10">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Section title="Contact">
            <Input label="Email" type="email" value={email} onChange={(v) => setEmail(v)} />
            {!summary.guestCheckoutEnabled && (
              <p className="text-xs text-[var(--color-ink-soft)]">
                <Link href="/account/orders" className="underline">
                  Sign in
                </Link>{' '}
                to check out.
              </p>
            )}
          </Section>

          <Section title="Shipping address">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Full name" value={addr.fullName} onChange={(v) => set('fullName', v)} />
              <Input label="Phone" value={addr.phone} onChange={(v) => set('phone', v)} />
              <div className="sm:col-span-2">
                <Input label="Address" value={addr.line1} onChange={(v) => set('line1', v)} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Apartment, suite (optional)" value={addr.line2} onChange={(v) => set('line2', v)} />
              </div>
              <Input label="City" value={addr.city} onChange={(v) => set('city', v)} />
              <Input label="State" value={addr.state} onChange={(v) => set('state', v)} />
              <Input
                label="PIN code"
                value={addr.pincode}
                onChange={(v) => set('pincode', v)}
                onBlur={() => addr.pincode.length >= 5 && load(addr.pincode)}
              />
            </div>
            {summary.serviceability && (
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {summary.serviceability.serviceable
                  ? summary.serviceability.etaMinDays
                    ? `Delivers in ${summary.serviceability.etaMinDays}–${summary.serviceability.etaMaxDays} days`
                    : 'Delivery available to this PIN code'
                  : 'We may not deliver to this PIN code yet'}
              </p>
            )}
          </Section>

          <Section title="Delivery">
            {summary.shippingOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 text-sm ${
                  shippingRateId === opt.id ? 'border-[var(--color-ink)]' : 'border-[var(--color-sand)]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shipping"
                    checked={shippingRateId === opt.id}
                    onChange={() => setShippingRateId(opt.id)}
                  />
                  <span>
                    <span className="font-medium">{opt.name}</span>
                    {opt.minDeliveryDays && (
                      <span className="block text-xs text-[var(--color-ink-soft)]">
                        {opt.minDeliveryDays}–{opt.maxDeliveryDays} business days
                      </span>
                    )}
                  </span>
                </span>
                <span className="font-medium">
                  {Number(opt.price) === 0 ? 'Free' : inr(opt.price)}
                </span>
              </label>
            ))}
          </Section>

          <Section title="Payment">
            {summary.paymentMethods.map((m) => {
              const disabled = m.method === 'COD' && !m.codAvailable;
              return (
                <label
                  key={m.method}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm ${
                    paymentMethod === m.method ? 'border-[var(--color-ink)]' : 'border-[var(--color-sand)]'
                  } ${disabled ? 'opacity-40' : ''}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    disabled={disabled}
                    checked={paymentMethod === m.method}
                    onChange={() => setPaymentMethod(m.method)}
                  />
                  <span>
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-xs text-[var(--color-ink-soft)]">
                      {m.description}
                      {selectedShipping && m.method === 'COD' && Number(selectedShipping.codFee) > 0
                        ? ` · ${inr(selectedShipping.codFee)} COD fee`
                        : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </Section>

          <Section title="Order note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[var(--color-sand)] px-3 py-2 text-sm"
              placeholder="Delivery instructions, gift message…"
            />
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-[var(--color-sand)] p-5">
            <h2 className="text-sm font-semibold">Your order</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {summary.cart.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.productName}
                    {i.variantLabel ? ` · ${i.variantLabel}` : ''} × {i.quantity}
                  </span>
                  <span>{inr(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-[var(--color-sand)] pt-4 text-sm">
              <SummaryRow label="Subtotal" value={inr(totals?.itemsSubtotal ?? '0')} />
              {Number(totals?.discountTotal ?? 0) > 0 && (
                <SummaryRow label="Discount" value={`− ${inr(totals!.discountTotal)}`} />
              )}
              <SummaryRow
                label="Shipping"
                value={Number(totals?.shippingTotal ?? 0) === 0 ? 'Free' : inr(totals!.shippingTotal)}
              />
              <SummaryRow label="Tax (incl.)" value={inr(totals?.taxTotal ?? '0')} muted />
              <div className="border-t border-[var(--color-sand)] pt-2">
                <SummaryRow label="Total" value={inr(totals?.grandTotal ?? '0')} bold />
              </div>
            </dl>

            {error && <p className="mt-3 text-sm text-[var(--color-sale)]">{error}</p>}

            <button
              onClick={placeOrder}
              disabled={placing}
              className="mt-5 w-full rounded-full bg-[var(--color-ink)] py-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {placing ? 'Placing order…' : `Place order · ${inr(totals?.grandTotal ?? '0')}`}
            </button>
            <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)]">
              Secure checkout · your payment is verified server-side
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-[var(--color-sand)] px-3 py-2 text-sm focus:border-[var(--color-ink)] focus:outline-none"
      />
    </label>
  );
}

function SummaryRow({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <dt className={muted ? 'text-[var(--color-ink-soft)]' : ''}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------- Razorpay (optional) */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function payWithRazorpay(
  orderNumber: string,
  payment: { providerOrderId?: string; amount: number; currency: string; clientConfig?: Record<string, unknown> },
  prefill: { email: string; contact: string; name: string },
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  await loadScript('https://checkout.razorpay.com/v1/checkout.js');
  if (!window.Razorpay) throw new Error('Could not load the payment window');
  const cfg = payment.clientConfig ?? {};
  const orderUrl = (extra = '') =>
    `/order/${orderNumber}?email=${encodeURIComponent(prefill.email)}${extra}`;
  const rzp = new window.Razorpay({
    key: cfg.keyId,
    order_id: payment.providerOrderId,
    amount: Math.round(payment.amount * 100),
    currency: payment.currency,
    name: cfg.name ?? 'Slay Jeans',
    prefill,
    theme: { color: '#14110f' },
    handler: async (resp: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      try {
        await storefront.verifyPayment({
          orderNumber,
          providerOrderId: resp.razorpay_order_id,
          providerPaymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        });
        router.push(orderUrl());
      } catch {
        router.push(orderUrl('&payment=failed'));
      }
    },
    modal: { ondismiss: () => router.push(orderUrl('&payment=pending')) },
  });
  rzp.open();
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('script load failed'));
    document.body.appendChild(el);
  });
}
