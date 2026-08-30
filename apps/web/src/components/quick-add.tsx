'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import type { ProductDetail } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Variant = ProductDetail['variants'][number];

function stockOf(v: Variant): number {
  return v.inventory.reduce((sum, i) => sum + Math.max(0, i.onHand - i.reserved), 0);
}

function sizeLabel(v: Variant): string {
  return v.optionValues.map((o) => o.optionValue.value).join(' / ');
}

/**
 * In-card "Quick add" — lazily loads the product's variants on first open, then
 * lets the shopper pick a size and drop it straight into the bag. Falls back to
 * nothing destructive: on any error it simply asks them to open the product.
 */
export function QuickAdd({ slug, productName }: { slug: string; productName: string }) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'adding' | 'added' | 'error'>('idle');

  async function reveal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    if (variants || state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${slug}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error('load failed');
      const data = (await res.json()) as ProductDetail;
      setVariants(data.variants);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  async function pick(v: Variant, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (stockOf(v) <= 0 || state === 'adding') return;
    setState('adding');
    try {
      await addItem(v.id, 1);
      setState('added');
      setTimeout(() => {
        setState('idle');
        setOpen(false);
      }, 1600);
    } catch {
      setState('error');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={reveal}
        className="w-full bg-[var(--color-ink)]/92 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur transition hover:bg-[var(--color-ink)]"
      >
        Quick add
      </button>
    );
  }

  return (
    <div
      className="w-full bg-[var(--color-paper)] px-3 py-2.5 text-center shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
      onClick={(e) => e.preventDefault()}
    >
      {state === 'loading' && (
        <p className="py-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
          Loading sizes…
        </p>
      )}

      {state === 'error' && (
        <p className="py-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--color-sale)]">
          Open product to add
        </p>
      )}

      {state === 'added' && (
        <p className="py-1.5 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-ink)]">
          Added to bag ✓
        </p>
      )}

      {variants && (state === 'idle' || state === 'adding') && (
        <>
          <p className="mb-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-[var(--color-ink-mute)]">
            Select size
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {variants.map((v) => {
              const out = stockOf(v) <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out || state === 'adding'}
                  onClick={(e) => pick(v, e)}
                  aria-label={`Add size ${sizeLabel(v)} of ${productName}`}
                  className={`min-w-8 rounded border px-2 py-1 text-xs transition ${
                    out
                      ? 'cursor-not-allowed border-[var(--color-sand)] text-[var(--color-ink-mute)] line-through'
                      : 'border-[var(--color-sand)] hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white'
                  }`}
                >
                  {sizeLabel(v)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
