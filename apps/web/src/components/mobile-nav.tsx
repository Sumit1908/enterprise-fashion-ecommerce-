'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CategoryNode } from '@/lib/api';
import { FITS } from '@/lib/fits';

export function MobileNav({ tree }: { tree: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const primary = tree.filter((c) => ['women', 'men', 'kids'].includes(c.slug));
  const secondary = tree.filter((c) => !['women', 'men', 'kids'].includes(c.slug));

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} aria-hidden />
            <nav className="relative flex w-[86%] max-w-sm flex-col bg-[var(--color-paper)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--color-sand)] px-5 py-4">
                <span className="font-display text-lg uppercase tracking-[0.2em]">Slay&nbsp;Jeans</span>
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
                <Link
                  href="/collections/new-arrivals"
                  className="block py-3 text-base font-medium uppercase tracking-[0.1em]"
                >
                  New In
                </Link>

                {primary.map((c) => {
                  const kids = c.children.filter((k) => k.showInMenu);
                  const isOpen = expanded === c.slug;
                  return (
                    <div key={c.id} className="border-t border-[var(--color-sand)]">
                      <div className="flex items-center justify-between">
                        <Link href={`/c/${c.slug}`} className="py-3 text-base font-medium uppercase tracking-[0.1em]">
                          {c.name}
                        </Link>
                        {kids.length > 0 && (
                          <button
                            type="button"
                            aria-label={`Toggle ${c.name}`}
                            onClick={() => setExpanded(isOpen ? null : c.slug)}
                            className="flex h-9 w-9 items-center justify-center text-lg"
                          >
                            {isOpen ? '−' : '+'}
                          </button>
                        )}
                      </div>
                      {isOpen && kids.length > 0 && (
                        <ul className="pb-3 pl-1">
                          {kids.map((k) => (
                            <li key={k.id}>
                              <Link
                                href={`/c/${k.slug}`}
                                className="block py-2 text-sm text-[var(--color-ink-soft)]"
                              >
                                {k.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}

                <Link
                  href="/collections/sale"
                  className="block border-t border-[var(--color-sand)] py-3 text-base font-semibold uppercase tracking-[0.1em] text-[var(--color-sale)]"
                >
                  Sale
                </Link>

                <p className="eyebrow mt-6">Shop by Fit</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {FITS.map((f) => (
                    <li key={f.query}>
                      <Link
                        href={`/search?q=${f.query}`}
                        className="rounded-full border border-[var(--color-sand)] px-3 py-1.5 text-xs"
                      >
                        {f.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                {secondary.length > 0 && (
                  <>
                    <p className="eyebrow mt-6">More</p>
                    <ul className="mt-3 grid grid-cols-2 gap-x-4">
                      {secondary.map((c) => (
                        <li key={c.id}>
                          <Link href={`/c/${c.slug}`} className="block py-2 text-sm text-[var(--color-ink-soft)]">
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <div className="mt-6 space-y-1 border-t border-[var(--color-sand)] pt-4 text-sm">
                  <Link href="/search" className="block py-2.5">Search</Link>
                  <Link href="/wishlist" className="block py-2.5">Wishlist</Link>
                  <Link href="/account/orders" className="block py-2.5">Orders &amp; account</Link>
                  <Link href="/cart" className="block py-2.5">Cart</Link>
                </div>
              </div>

              <p className="border-t border-[var(--color-sand)] px-5 py-4 text-xs text-[var(--color-ink-soft)]">
                Complimentary shipping over ₹999 · Easy 7-day returns · COD available
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
        <span className="relative block h-3 w-5">
          <span className="absolute left-0 top-0 h-px w-5 bg-[var(--color-ink)]" />
          <span className="absolute left-0 top-1.5 h-px w-5 bg-[var(--color-ink)]" />
          <span className="absolute left-0 top-3 h-px w-5 bg-[var(--color-ink)]" />
        </span>
      </button>
      {drawer}
    </div>
  );
}
