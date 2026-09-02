'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import {
  storefront,
  inr,
  ApiError,
  type CheckoutSummary,
  type PincodeLookup,
} from '@/lib/storefront';

interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
}
const EMPTY_ADDR: Address = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
};

type PinStatus = 'idle' | 'checking' | 'ok' | 'invalid' | 'unserviceable' | 'error';

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

  const [pinStatus, setPinStatus] = useState<PinStatus>('idle');
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [geo, setGeo] = useState<PincodeLookup | null>(null);
  const pinReqId = useRef(0);

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

  /** Verify the PIN server-side once it's exactly 6 digits; auto-fill city/state. */
  const verifyPin = useCallback(async (pin: string) => {
    const reqId = ++pinReqId.current;
    setPinStatus('checking');
    setPinMessage('Checking PIN code…');
    setGeo(null);
    try {
      const res = await storefront.lookupPincode(pin);
      if (reqId !== pinReqId.current) return;
      if (!res.serviceable) {
        setGeo(res);
        setPinStatus('unserviceable');
        setPinMessage('Delivery is not available at this PIN code.');
        return;
      }
      setGeo(res);
      setPinStatus('ok');
      setPinMessage('PIN code verified');
    } catch (e) {
      if (reqId !== pinReqId.current) return;
      setGeo(null);
      if (e instanceof ApiError && e.status === 404) {
        setPinStatus('invalid');
        setPinMessage('Invalid PIN code. Please check and try again.');
      } else {
        setPinStatus('error');
        setPinMessage('Unable to verify PIN code. Please try again.');
      }
    }
  }, []);

  useEffect(() => {
    const pin = addr.pincode;
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      pinReqId.current++;
      setGeo(null);
      if (pin.length === 6) {
        setPinStatus('invalid');
        setPinMessage('Invalid PIN code. Please check and try again.');
      } else {
        setPinStatus(pin.length === 0 ? 'idle' : 'checking');
        setPinMessage(null);
      }
      return;
    }
    const t = setTimeout(() => void verifyPin(pin), 250);
    return () => clearTimeout(t);
  }, [addr.pincode, verifyPin]);

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
    ] as const) {
      if (!addr[k].trim()) return setError(`Please enter your ${label}.`);
    }
    if (addr.line1.trim().length < 10) {
      return setError('Please enter your full street address (house / building number, street and area).');
    }
    if (!/^[1-9][0-9]{5}$/.test(addr.pincode)) return setError('Please enter a valid 6-digit PIN code.');
    if (pinStatus === 'checking') return setError('Please wait — we are still verifying your PIN code.');
    if (pinStatus === 'invalid') return setError('Please enter a valid PIN code.');
    if (pinStatus === 'unserviceable') return setError('Sorry, delivery is currently unavailable at this PIN code.');
    if (pinStatus === 'error') return setError('We could not verify your PIN code. Please try again.');
    if (pinStatus !== 'ok' || !geo) return setError('Please enter a valid PIN code.');
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
          city: geo.city,
          state: geo.state,
          district: geo.district,
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

  const pinToneClass =
    pinStatus === 'ok'
      ? 'text-[var(--color-ink-soft)]'
      : pinStatus === 'checking'
        ? 'text-[var(--color-ink-soft)]'
        : 'text-[var(--color-sale)]';

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
                <Input
                  label="Address (house / building, street, area)"
                  value={addr.line1}
                  onChange={(v) => set('line1', v)}
                />
              </div>
              <div className="sm:col-span-2">
                <Input label="Apartment, suite (optional)" value={addr.line2} onChange={(v) => set('line2', v)} />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="PIN code"
                  value={addr.pincode}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
                />
                {pinMessage && (
                  <p className={`mt-1 flex items-center gap-1.5 text-xs ${pinToneClass}`}>
                    {pinStatus === 'ok' && <span aria-hidden>✓</span>}
                    {pinStatus === 'checking' && (
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                      />
                    )}
                    <span>{pinMessage}</span>
                    {pinStatus === 'error' && (
                      <button
                        type="button"
                        onClick={() => void verifyPin(addr.pincode)}
                        className="underline"
                      >
                        Retry
                      </button>
                    )}
                  </p>
                )}
              </div>

              <LockedField label="City / District" value={geo?.city ?? ''} />
              <LockedField label="State" value={geo?.state ?? ''} />
            </div>

            {pinStatus === 'ok' && geo && (
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Delivery available · {geo.etaMinDays}–{geo.etaMaxDays} business days · FREE
              </p>
            )}
          </Section>

          <Section title="Delivery">
            <div className="flex items-center justify-between rounded-lg border border-[var(--color-ink)] p-4 text-sm">
              <span>
                <span className="font-medium">Free delivery</span>
                <span className="block text-xs text-[var(--color-ink-soft)]">
                  {geo?.etaMinDays ?? selectedShipping?.minDeliveryDays ?? 3}–
                  {geo?.etaMaxDays ?? selectedShipping?.maxDeliveryDays ?? 7} business days
                </span>
              </span>
              <span className="font-semibold uppercase tracking-[0.08em]">Free</span>
            </div>
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
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  inputMode?: 'numeric' | 'text' | 'tel' | 'email';
  maxLength?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-[var(--color-sand)] px-3 py-2 text-sm focus:border-[var(--color-ink)] focus:outline-none"
      />
    </label>
  );
}

/** City / State — filled from the PIN lookup, not editable by the shopper. */
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">
        {label} <span className="text-[var(--color-ink-soft)]">· auto</span>
      </span>
      <input
        value={value}
        readOnly
        tabIndex={-1}
        aria-readonly="true"
        placeholder="From PIN code"
        className="w-full cursor-not-allowed rounded-md border border-dashed border-[var(--color-sand)] bg-[var(--color-bone)] px-3 py-2 text-sm text-[var(--color-ink-soft)] focus:outline-none"
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
    name: cfg.name ?? 'Velor House',
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
