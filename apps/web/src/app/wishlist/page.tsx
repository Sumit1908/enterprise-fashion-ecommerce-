'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { readWishlist } from '@/components/wishlist-button';
import type { ProductCard as Card } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function WishlistPage() {
  const [items, setItems] = useState<Card[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const slugs = readWishlist();
      if (slugs.length === 0) {
        if (!cancelled) setItems([]);
        return;
      }
      const results = await Promise.all(
        slugs.map((slug) =>
          fetch(`${API_BASE}/api/v1/products/${slug}`, { headers: { accept: 'application/json' } })
            .then((r) => (r.ok ? (r.json() as Promise<Card>) : null))
            .catch(() => null),
        ),
      );
      if (!cancelled) setItems(results.filter((p): p is Card => !!p));
    }
    void load();
    const sync = () => void load();
    window.addEventListener('sj:wishlist', sync);
    return () => {
      cancelled = true;
      window.removeEventListener('sj:wishlist', sync);
    };
  }, []);

  return (
    <div className="container-wide py-12 lg:py-16">
      <p className="eyebrow">Saved for later</p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">Your Wishlist</h1>

      {items === null && (
        <p className="mt-8 text-sm text-[var(--color-ink-soft)]">Loading your saved pieces…</p>
      )}

      {items !== null && items.length === 0 && (
        <div className="mt-10 border border-[var(--color-sand)] bg-[var(--color-paper)] p-12 text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">
            You haven&apos;t saved anything yet. Tap the heart on a product to keep it here.
          </p>
          <Link href="/shop" className="btn btn-primary mt-6">Browse denim</Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
