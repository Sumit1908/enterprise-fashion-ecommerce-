'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProductCard } from '@/components/ui/ProductCard';
import { PRODUCTS, type Product } from '@/lib/data/products';

const TABS: { label: string; value: Product['tags'][number] }[] = [
  { label: 'Bestsellers', value: 'bestseller' },
  { label: 'New Arrivals', value: 'new' },
  { label: 'Classics', value: 'classic' },
];

export function BestsellerSection() {
  const [tab, setTab] = useState<Product['tags'][number]>('bestseller');
  const items = PRODUCTS.filter((p) => p.tags.includes(tab)).slice(0, 10);

  return (
    <section className="container-page section-gap">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-9">
        <div>
          <p className="eyebrow mb-1.5">Curated for you</p>
          <h2 className="h-section">Shop Bestsellers</h2>
        </div>
        <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`pill text-[12px] ${tab === t.value ? 'pill--active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 5} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/shop" className="btn btn-outline rounded-[12px] px-9 py-3 text-[13px] uppercase tracking-[0.12em]">
          View All Products
        </Link>
      </div>
    </section>
  );
}
