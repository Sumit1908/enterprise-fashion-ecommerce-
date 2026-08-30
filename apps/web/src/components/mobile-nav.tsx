'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CategoryNode } from '@/lib/api';

export function MobileNav({ nav }: { nav: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex lg:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <nav className="relative flex w-[84%] max-w-sm flex-col bg-[var(--color-paper)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--color-sand)] px-5 py-4">
                <span className="font-display text-xl font-semibold">
                  Slay<span className="text-[var(--color-accent)]">Jeans</span>
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="-mr-2 flex h-9 w-9 items-center justify-center text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <ul className="space-y-1">
                  {nav.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/c/${c.slug}`}
                        className="block rounded-md px-2 py-3 text-base font-medium hover:bg-[var(--color-bone)]"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/collections/sale"
                      className="block rounded-md px-2 py-3 text-base font-semibold text-[var(--color-sale)] hover:bg-[var(--color-bone)]"
                    >
                      Sale
                    </Link>
                  </li>
                </ul>

                <div className="mt-6 space-y-1 border-t border-[var(--color-sand)] pt-4 text-sm">
                  <Link
                    href="/search"
                    className="block rounded-md px-2 py-2.5 hover:bg-[var(--color-bone)]"
                  >
                    Search
                  </Link>
                  <Link
                    href="/account/orders"
                    className="block rounded-md px-2 py-2.5 hover:bg-[var(--color-bone)]"
                  >
                    Orders &amp; account
                  </Link>
                  <Link
                    href="/cart"
                    className="block rounded-md px-2 py-2.5 hover:bg-[var(--color-bone)]"
                  >
                    Cart
                  </Link>
                </div>
              </div>

              <p className="border-t border-[var(--color-sand)] px-5 py-4 text-xs text-[var(--color-ink-soft)]">
                Free shipping over ₹999 · Easy 7-day returns · COD available
              </p>
            </nav>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center"
      >
        <span className="relative block h-3.5 w-5">
          <span className="absolute left-0 top-0 h-0.5 w-5 bg-[var(--color-ink)]" />
          <span className="absolute left-0 top-1.5 h-0.5 w-5 bg-[var(--color-ink)]" />
          <span className="absolute left-0 top-3 h-0.5 w-5 bg-[var(--color-ink)]" />
        </span>
      </button>
      {drawer}
    </div>
  );
}
