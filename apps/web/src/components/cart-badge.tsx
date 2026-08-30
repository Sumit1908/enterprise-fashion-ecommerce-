'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export function CartBadge() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
      className="relative hover:text-[var(--color-accent)]"
    >
      Cart
      {itemCount > 0 && (
        <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-ink)] px-1 text-[10px] font-semibold text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
