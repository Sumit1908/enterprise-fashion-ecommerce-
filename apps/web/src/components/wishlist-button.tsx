'use client';

import { useState } from 'react';
import { useWishlist } from '@/lib/wishlist-context';

/**
 * Heart toggle. Saves to the signed-in account when available, otherwise to a
 * per-browser list that is merged into the account on sign-in.
 */
export function WishlistButton({
  slug,
  className = '',
}: {
  slug: string;
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  const saved = has(slug);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(slug);
    } catch {
      /* ignore — surfaced elsewhere */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-paper)]/85 text-[var(--color-ink)] backdrop-blur transition hover:bg-[var(--color-paper)] disabled:opacity-60 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M12 20.5S3.5 14.7 3.5 8.9A4.4 4.4 0 0 1 12 6.9a4.4 4.4 0 0 1 8.5 2c0 5.8-8.5 11.6-8.5 11.6z" />
      </svg>
    </button>
  );
}
