'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storefront, inr, ApiError } from '@/lib/storefront';
import { useAuth } from '@/lib/auth-context';

type Row = Awaited<ReturnType<typeof storefront.myOrders>>[number];

export default function AccountOrdersPage() {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState<Row[] | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [trackNumber, setTrackNumber] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setNeedAuth(true);
      setOrders([]);
      return;
    }
    storefront
      .myOrders()
      .then(setOrders)
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setNeedAuth(true);
        else setOrders([]);
      });
  }, [user, ready]);

  return (
    <div className="container-wide max-w-2xl py-12">
      <p className="eyebrow">Account</p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">Your orders</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trackNumber.trim()) window.location.href = `/order/${trackNumber.trim()}`;
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={trackNumber}
          onChange={(e) => setTrackNumber(e.target.value)}
          placeholder="Track by order number, e.g. SJ-2026-000001"
          className="min-w-0 flex-1 rounded-md border border-[var(--color-sand)] px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-[var(--color-ink)] px-4 py-2 text-sm font-medium">Track</button>
      </form>

      {needAuth && (
        <p className="mt-8 border border-[var(--color-sand)] bg-[var(--color-paper)] p-4 text-sm text-[var(--color-ink-soft)]">
          <Link href="/account?next=/account/orders" className="link-underline font-semibold text-[var(--color-ink)]">
            Sign in
          </Link>{' '}
          to see your order history, or track a guest order with the number above and the email
          used at checkout.
        </p>
      )}

      {orders && orders.length > 0 && (
        <ul className="mt-8 divide-y divide-[var(--color-sand)] border-y border-[var(--color-sand)]">
          {orders.map((o) => (
            <li key={o.orderNumber} className="flex items-center justify-between gap-4 py-4">
              <div>
                <Link href={`/order/${o.orderNumber}`} className="text-sm font-medium hover:underline">
                  {o.orderNumber}
                </Link>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  {new Date(o.placedAt).toLocaleDateString('en-IN')} · {o.itemCount} item
                  {o.itemCount === 1 ? '' : 's'} · {o.status.toLowerCase()}
                </p>
              </div>
              <p className="text-sm font-semibold">{inr(o.grandTotal)}</p>
            </li>
          ))}
        </ul>
      )}

      {orders && orders.length === 0 && !needAuth && (
        <p className="mt-8 text-sm text-[var(--color-ink-soft)]">No orders yet.</p>
      )}
    </div>
  );
}
