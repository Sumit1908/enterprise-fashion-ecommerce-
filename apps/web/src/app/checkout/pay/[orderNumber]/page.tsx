'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { storefront, inr, type OrderView } from '@/lib/storefront';
import { useCart } from '@/lib/cart-context';

/**
 * Sandbox payment page for the mock gateway (local dev / no real credentials).
 * A real gateway (Razorpay) opens its own hosted widget from the checkout page.
 */
export default function MockPayPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const router = useRouter();
  const { refresh } = useCart();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [busy, setBusy] = useState<null | 'success' | 'failure'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storefront
      .getOrder(orderNumber)
      .then(setOrder)
      .catch(() => setError('Could not load this order.'));
  }, [orderNumber]);

  async function complete(outcome: 'success' | 'failure') {
    setBusy(outcome);
    setError(null);
    try {
      await storefront.verifyPayment({ orderNumber, mockOutcome: outcome });
      await refresh();
      router.push(`/order/${orderNumber}`);
    } catch (e) {
      if (outcome === 'failure') {
        await refresh();
        router.push(`/order/${orderNumber}?payment=failed`);
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
