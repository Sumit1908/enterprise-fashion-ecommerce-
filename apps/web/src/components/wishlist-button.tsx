'use client';

import { useEffect, useState } from 'react';

const KEY = 'sj_wishlist';

export function readWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs));
    window.dispatchEvent(new CustomEvent('sj:wishlist'));
  } catch {
    /* ignore */
  }
}

/**
 * Lightweight wishlist affordance — persists to localStorage only (no account
 * or backend dependency). A per-visitor save-for-later convenience.
 */
export function WishlistButton({
  slug,
  className = '',
}: {
  slug: string;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(readWishlist().includes(slug));
    sync();
    window.addEventListener('sj:wishlist', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sj:wishlist', sync);
      window.removeEventListener('storage', sync);
    };
  }, [slug]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const list = readWishlist();
    write(list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list]);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-paper)]/85 text-[var(--color-ink)] backdrop-blur transition hover:bg-[var(--color-paper)] ${className}`}
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
