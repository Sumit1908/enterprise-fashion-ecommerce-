import Link from 'next/link';
import { api, type CategoryNode } from '@/lib/api';
import { CartBadge } from '@/components/cart-badge';
import { MobileNav } from '@/components/mobile-nav';
import { SiteNav } from '@/components/site-nav';

async function getTree(): Promise<CategoryNode[]> {
  try {
    return (await api.categories()).filter((c) => !c.parentId && c.showInMenu);
  } catch {
    return [];
  }
}

const ANNOUNCEMENTS = [
  'Complimentary shipping on orders over ₹999',
  'Easy 7-day returns · Cash on Delivery available',
  'New in: The Autumn Denim Drop',
];

export async function SiteHeader() {
  const tree = await getTree();

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-paper)]">
      <div className="overflow-hidden bg-[var(--color-ink)] text-[var(--color-bone)]">
        <div className="container-wide flex h-9 items-center justify-center">
          <div className="hide-scrollbar flex gap-10 overflow-x-auto whitespace-nowrap text-[0.68rem] uppercase tracking-[0.18em]">
            {ANNOUNCEMENTS.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--color-sand)] bg-[var(--color-paper)]/95 backdrop-blur">
        <div className="container-wide relative flex h-[4.25rem] items-center justify-between gap-4">
          <div className="flex flex-1 items-center lg:hidden">
            <MobileNav tree={tree} />
          </div>

          <Link
            href="/"
            className="font-display text-[1.35rem] uppercase tracking-[0.2em] text-[var(--color-ink)] lg:text-[1.5rem]"
          >
            Slay&nbsp;Jeans
          </Link>

          <SiteNav tree={tree} />

          <div className="flex flex-1 items-center justify-end gap-4 text-[var(--color-ink)] sm:gap-5">
            <Link href="/search" aria-label="Search" className="hover:text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </Link>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="hidden hover:text-[var(--color-accent)] sm:inline"
            >
              <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 20.5S3.5 14.7 3.5 8.9A4.4 4.4 0 0 1 12 6.9a4.4 4.4 0 0 1 8.5 2c0 5.8-8.5 11.6-8.5 11.6z" />
              </svg>
            </Link>
            <Link
              href="/account/orders"
              aria-label="Account"
              className="hidden hover:text-[var(--color-accent)] sm:inline"
            >
              <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
              </svg>
            </Link>
            <CartBadge />
          </div>
        </div>
      </div>
    </header>
  );
}
