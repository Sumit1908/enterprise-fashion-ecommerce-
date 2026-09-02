'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { inr } from '@/lib/storefront';

export default function CartPage() {
  const { cart, loading, error, updateItem, removeItem, applyCoupon, removeCoupon } = useCart();
  const router = useRouter();
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  if (loading && !cart) {
    return <div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading your bag…</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-wide py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Your bag is empty</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Add a few pieces you love and they&apos;ll show up here.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-[var(--color-ink)] px-8 py-4 text-sm font-semibold text-white"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  const s = cart.summary;

  async function changeQty(itemId: string, qty: number) {
    setRowBusy(itemId);
    try {
      if (qty <= 0) await removeItem(itemId);
      else await updateItem(itemId, qty);
    } catch {
      /* surfaced via context error */
    } finally {
      setRowBusy(null);
    }
  }

  async function submitCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      await applyCoupon(couponInput.trim());
      setCouponInput('');
    } catch (err) {
      setCouponError((err as Error).message);
    } finally {
      setCouponBusy(false);
    }
  }

  return (
    <div className="container-wide py-10">
      <h1 className="font-display text-3xl font-semibold">Your bag</h1>

      {cart.notices.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg bg-[var(--color-sale)]/10 p-4 text-sm text-[var(--color-sale)]">
          {cart.notices.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-[var(--color-sale)]">{error}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-[var(--color-sand)] border-y border-[var(--color-sand)]">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-5">
              <Link
                href={`/p/${item.productSlug}`}
                className="relative h-28 w-24 shrink-0 overflow-hidden rounded-md bg-[var(--color-sand)]"
              >
                {item.imageUrl && (
                  <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="96px" />
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link href={`/p/${item.productSlug}`} className="text-sm font-medium hover:underline">
                      {item.productName}
                    </Link>
                    {item.variantLabel && (
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{item.variantLabel}</p>
                    )}
                    {!item.inStock && (
                      <p className="mt-1 text-xs font-medium text-[var(--color-sale)]">Out of stock</p>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{inr(item.lineTotal)}</p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-full border border-[var(--color-sand)] text-sm">
                    <button
                      aria-label="Decrease"
                      disabled={rowBusy === item.id}
                      onClick={() => changeQty(item.id, item.quantity - 1)}
                      className="px-3 py-1.5 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{item.quantity}</span>
                    <button
                      aria-label="Increase"
                      disabled={rowBusy === item.id || item.quantity >= item.availableStock}
                      onClick={() => changeQty(item.id, item.quantity + 1)}
                      className="px-3 py-1.5 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => changeQty(item.id, 0)}
                    disabled={rowBusy === item.id}
                    className="text-xs text-[var(--color-ink-soft)] underline hover:text-[var(--color-ink)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-[var(--color-sand)] p-5">
            <h2 className="text-sm font-semibold">Order summary</h2>

            <form onSubmit={submitCoupon} className="mt-4">
              {cart.coupon ? (
                <div className="flex items-center justify-between rounded-md bg-[var(--color-bone)] px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{cart.coupon.code}</span> applied
                  </span>
                  <button type="button" onClick={() => removeCoupon()} className="text-xs underline">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Discount code"
                    className="min-w-0 flex-1 rounded-md border border-[var(--color-sand)] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={couponBusy}
                    className="rounded-md border border-[var(--color-ink)] px-4 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && <p className="mt-2 text-xs text-[var(--color-sale)]">{couponError}</p>}
            </form>

            <dl className="mt-5 space-y-2 text-sm">
              <Row label="Subtotal" value={inr(s.itemsSubtotal)} />
              {Number(s.discountTotal) > 0 && (
                <Row label="Discount" value={`− ${inr(s.discountTotal)}`} accent />
              )}
              <Row
                label="Shipping"
                value={Number(s.shippingTotal) === 0 ? 'Free' : inr(s.shippingTotal)}
              />
              <Row label="Tax (incl.)" value={inr(s.taxTotal)} muted />
              <div className="border-t border-[var(--color-sand)] pt-2">
                <Row label="Total" value={inr(s.grandTotal)} bold />
              </div>
            </dl>

            <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
              Free delivery on every order.
            </p>

            <button
              onClick={() => router.push('/checkout')}
              disabled={cart.items.every((i) => !i.inStock)}
              className="mt-5 w-full rounded-full bg-[var(--color-ink)] py-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Proceed to checkout
            </button>
            <Link href="/" className="mt-3 block text-center text-xs text-[var(--color-ink-soft)] underline">
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <dt className={muted ? 'text-[var(--color-ink-soft)]' : ''}>{label}</dt>
      <dd className={accent ? 'text-[var(--color-sale)]' : ''}>{value}</dd>
    </div>
  );
}
