'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { storefront, inr, type OrderView } from '@/lib/storefront';
import { useCart } from '@/lib/cart-context';

export default function MockPayPageWrapper({ params }: { params: Promise<{ orderNumber: string }> }) {
  return (
    <Suspense fallback={<div className="container-wide py-20 text-center text-sm">Loading…</div>}>
      <MockPayPage params={params} />
    </Suspense>
  );
}

/**
 * Sandbox payment page for the mock gateway (local dev / no real credentials).
 * A real gateway (Razorpay) opens its own hosted widget from the checkout page.
 */
function MockPayPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const router = useRouter();
  const email = useSearchParams().get('email') ?? undefined;
  const { refresh } = useCart();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [busy, setBusy] = useState<null | 'success' | 'failure'>(null);
  const [error, setError] = useState<string | null>(null);

  const orderUrl = (extra = '') =>
    `/order/${orderNumber}${email ? `?email=${encodeURIComponent(email)}` : ''}${extra}`;

  useEffect(() => {
    storefront
      .getOrder(orderNumber, email)
      .then(setOrder)
      .catch(() => undefined);
  }, [orderNumber, email]);

  async function complete(outcome: 'success' | 'failure') {
    setBusy(outcome);
    setError(null);
    try {
      await storefront.verifyPayment({ orderNumber, email, mockOutcome: outcome });
      await refresh();
      router.push(orderUrl());
    } catch (e) {
      if (outcome === 'failure') {
        await refresh();
        router.push(orderUrl(email ? '&payment=failed' : '?payment=failed'));
        return;
      }
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="container-wide flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-sand)] p-8 text-center">
        <p className="text-xs uppercase tracking-wide text-[var(--color-accent)]">Sandbox payment</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Confirm payment</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Order {orderNumber}</p>

        {order && (
          <p className="mt-4 text-3xl font-semibold">{inr(order.totals.grandTotal)}</p>
        )}

        <div className="mt-8 space-y-3">
          <button
            onClick={() => complete('success')}
            disabled={busy !== null}
            className="w-full rounded-full bg-[var(--color-ink)] py-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === 'success' ? 'Processing…' : 'Simulate successful payment'}
          </button>
          <button
            onClick={() => complete('failure')}
            disabled={busy !== null}
            className="w-full rounded-full border border-[var(--color-sale)] py-4 text-sm font-semibold text-[var(--color-sale)] disabled:opacity-50"
          >
            Simulate failed payment
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-[var(--color-sale)]">{error}</p>}
        <p className="mt-6 text-xs text-[var(--color-ink-soft)]">
          This screen appears only when no live payment gateway is configured.
        </p>
      </div>
    </div>
  );
}
