'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { CATEGORY_PILLS, MAIN_NAV } from '@/lib/data/nav';
import { useStore } from '@/lib/store';

export function MobileNav() {
  const { overlay, closeOverlay } = useStore();
  const open = overlay === 'menu';

  return (
    <div
      className={`fixed inset-0 z-[70] lg:hidden ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeOverlay}
      />
      <nav
        className={`absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <Logo />
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeOverlay}
            className="grid h-9 w-9 place-items-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul>
            {MAIN_NAV.map((l) => (
              <li key={l.href} className="border-b border-[var(--color-border)]">
                <Link
                  href={l.href}
                  onClick={closeOverlay}
                  className="block py-3.5 text-[15px] font-semibold uppercase tracking-[0.06em]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="eyebrow mt-6">Explore</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_PILLS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                onClick={closeOverlay}
                className={`pill text-[11px] ${p.sale ? 'pill--sale' : 'pill--soft'}`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          <div className="mt-6 space-y-1 border-t border-[var(--color-border)] pt-4 text-sm">
            <Link href="/wishlist" onClick={closeOverlay} className="block py-2.5">
              Wishlist
            </Link>
            <Link href="/account" onClick={closeOverlay} className="block py-2.5">
              Account &amp; orders
            </Link>
          </div>
        </div>

        <p className="border-t border-[var(--color-border)] px-5 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Free shipping on prepaid orders across India
        </p>
      </nav>
    </div>
  );
}
