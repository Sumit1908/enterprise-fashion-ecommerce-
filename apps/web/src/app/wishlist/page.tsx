'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';
import type { ProductCard as Card } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function WishlistPage() {
  const { user } = useAuth();
  const { slugs, products, ready, synced } = useWishlist();
  const [guestItems, setGuestItems] = useState<Card[] | null>(null);

  useEffect(() => {
    if (synced) return;
    let cancelled = false;
    async function load() {
      if (slugs.length === 0) {
        if (!cancelled) setGuestItems([]);
        return;
      }
      const results = await Promise.all(
        slugs.map((slug) =>
          fetch(`${API_BASE}/api/v1/products/${slug}`, { headers: { accept: 'application/json' } })
            .then((r) => (r.ok ? (r.json() as Promise<Card>) : null))
            .catch(() => null),
        ),
      );
      if (!cancelled) setGuestItems(results.filter((p): p is Card => !!p));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slugs, synced]);

  const items: Card[] = synced ? (products as unknown as Card[]) : (guestItems ?? []);
  const loading = synced ? !ready : guestItems === null;

  return (
    <div className="container-wide py-12 lg:py-16">
      <p className="eyebrow">Saved for later</p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">Your Wishlist</h1>

      {!user && slugs.length > 0 && (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
          Saved on this device.{' '}
          <Link href="/account" className="link-underline font-semibold text-[var(--color-ink)]">
            Sign in
          </Link>{' '}
          to keep your wishlist across devices.
        </p>
      )}

      {loading && <p className="mt-8 text-sm text-[var(--color-ink-soft)]">Loading your saved pieces…</p>}

      {!loading && items.length === 0 && (
        <div className="mt-10 border border-[var(--color-sand)] bg-[var(--color-paper)] p-12 text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">
            You haven&apos;t saved anything yet. Tap the heart on a product to keep it here.
          </p>
          <Link href="/shop" className="btn btn-primary mt-6">Browse denim</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
