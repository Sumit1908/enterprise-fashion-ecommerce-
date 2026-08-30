'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { ApiError } from '@/lib/storefront';
import type { ProductDetail } from '@/lib/api';

function stockOf(variant: ProductDetail['variants'][number]): number {
  return variant.inventory.reduce((sum, i) => sum + Math.max(0, i.onHand - i.reserved), 0);
}

export function AddToCart({ product }: { product: ProductDetail }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added'>('idle');
  const [error, setError] = useState<string | null>(null);

  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

  const matchedVariant = useMemo(() => {
    if (singleVariant) return singleVariant;
    if (product.options.length === 0) return null;
    if (Object.keys(selected).length < product.options.length) return null;
    return (
      product.variants.find((v) =>
        v.optionValues.every((ov) => {
          const optName = product.options.find((o) =>
            o.values.some((val) => val.id === ov.optionValue.id),
          )?.name;
          return optName ? selected[optName] === ov.optionValue.value : false;
        }),
      ) ?? null
    );
  }, [product, selected, singleVariant]);

  const available = matchedVariant ? stockOf(matchedVariant) : 0;
  const anyStock = product.variants.some((v) => stockOf(v) > 0);

  async function handleAdd() {
    setError(null);
    if (!matchedVariant) {
      setError('Please select ' + product.options.map((o) => o.name.toLowerCase()).join(' & '));
      return;
    }
    setStatus('adding');
    try {
      await addItem(matchedVariant.id, qty);
      setStatus('added');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (e) {
      setStatus('idle');
      setError(e instanceof ApiError ? e.message : 'Could not add to cart');
    }
  }

  async function handleBuyNow() {
    await handleAdd();
    if (matchedVariant) router.push('/checkout');
  }

  return (
    <div>
      {product.options.map((option) => (
        <div key={option.id} className="mt-6">
          <p className="text-sm font-medium">{option.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {option.values.map((v) => {
              const active = selected[option.name] === v.value;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelected((s) => ({ ...s, [option.name]: v.value }))}
                  className={`min-w-11 rounded-md border px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'border-[var(--color-cta)] bg-[var(--color-cta)] text-white'
                      : 'border-[var(--color-sand)] hover:border-[var(--color-ink)]'
                  }`}
                >
                  {v.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {matchedVariant && available > 0 && available <= 5 && (
        <p className="mt-3 text-xs font-medium text-[var(--color-sale)]">
          Only {available} left
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-[var(--color-sand)]">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-4 py-3 text-lg leading-none disabled:opacity-30"
            disabled={qty <= 1}
          >
            −
          </button>
          <span className="w-6 text-center text-sm">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(10, available || 10, q + 1))}
            className="px-4 py-3 text-lg leading-none disabled:opacity-30"
            disabled={matchedVariant ? qty >= available : false}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!anyStock || status === 'adding'}
          className="flex-1 rounded-full bg-[var(--color-cta)] py-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-cta-hover)] disabled:opacity-40"
        >
          {status === 'adding'
            ? 'Adding…'
            : status === 'added'
              ? 'Added ✓'
              : anyStock
                ? 'Add to Cart'
                : 'Out of Stock'}
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!anyStock || status === 'adding'}
          className="rounded-full border border-[var(--color-ink)] px-6 text-sm font-semibold disabled:opacity-40"
        >
          Buy Now
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-sale)]">{error}</p>}
      {status === 'added' && (
        <p className="mt-3 text-sm">
          Added to your bag.{' '}
          <Link href="/cart" className="font-semibold underline">
            View cart
          </Link>
        </p>
      )}

      {/* Sticky add-to-cart bar for mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[var(--color-sand)] bg-[var(--color-paper)] p-3 lg:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!anyStock || status === 'adding'}
          className="flex-1 rounded-full bg-[var(--color-cta)] py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {anyStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}
