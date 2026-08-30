'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { CategoryPills } from '@/components/home/CategoryPills';
import { MAIN_NAV } from '@/lib/data/nav';
import { useStore } from '@/lib/store';

export function Header() {
  const { cartCount, wishlist, openOverlay } = useStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div
        className={`border-b border-[var(--color-border)] bg-white transition-shadow ${
          scrolled ? 'shadow-[0_4px_20px_-12px_rgba(0,0,0,0.25)]' : ''
        }`}
      >
        <div className="container-page flex h-[68px] items-center gap-4 lg:h-[88px] lg:gap-8">
          {/* mobile menu */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => openOverlay('menu')}
            className="-ml-1.5 grid h-10 w-10 place-items-center lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Logo className="shrink-0" />

          {/* primary nav */}
          <nav className="hidden flex-1 items-center gap-4 xl:flex 2xl:gap-6">
            {MAIN_NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--color-ink)] transition-colors hover:text-[var(--color-red)] 2xl:text-[14px]"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* desktop search */}
          <button
            type="button"
            onClick={() => openOverlay('search')}
            className="ml-auto hidden h-11 w-[220px] shrink-0 items-center gap-3 rounded-full border border-[var(--color-red)] pl-4 pr-1.5 text-left text-[13px] text-[var(--color-text-muted)] transition hover:shadow-sm lg:flex xl:ml-3 2xl:w-[300px]"
          >
            <span className="flex-1 truncate">Search For Products</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-red)] text-white">
              <Search className="h-4 w-4" />
            </span>
          </button>

          {/* actions */}
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0 lg:gap-3">
            <button
              type="button"
              aria-label="Search"
              onClick={() => openOverlay('search')}
              className="grid h-10 w-10 place-items-center lg:hidden"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/wishlist"
              aria-label={`Wishlist, ${wishlist.length} items`}
              className="relative grid h-10 w-10 place-items-center hover:text-[var(--color-red)]"
            >
              <Heart className="h-[21px] w-[21px]" />
              {wishlist.length > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-ink)] px-1 text-[9px] font-bold text-white">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <button
              type="button"
              aria-label={`Cart, ${cartCount} items`}
              onClick={() => openOverlay('cart')}
              className="relative grid h-10 w-10 place-items-center hover:text-[var(--color-red)]"
            >
              <ShoppingBag className="h-[21px] w-[21px]" />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-red)] px-1 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            <Link
              href="/account"
              aria-label="Account"
              className="hidden h-10 w-10 place-items-center hover:text-[var(--color-red)] sm:grid"
            >
              <User className="h-[21px] w-[21px]" />
            </Link>
          </div>
        </div>
      </div>

      <CategoryPills />
    </header>
  );
}
