'use client';

import Link from 'next/link';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';

export function WishlistIcon() {
  const { count } = useWishlist();
  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist, ${count} item${count === 1 ? '' : 's'}`}
      className="relative hidden hover:text-[var(--color-accent)] sm:inline"
    >
      <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 20.5S3.5 14.7 3.5 8.9A4.4 4.4 0 0 1 12 6.9a4.4 4.4 0 0 1 8.5 2c0 5.8-8.5 11.6-8.5 11.6z" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[0.6rem] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function AccountIcon() {
  const { user } = useAuth();
  return (
    <Link
      href="/account"
      aria-label={user ? 'Your account' : 'Sign in'}
      className="hidden hover:text-[var(--color-accent)] sm:inline"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[1.15rem] w-[1.15rem]"
        fill={user ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </svg>
    </Link>
  );
}
