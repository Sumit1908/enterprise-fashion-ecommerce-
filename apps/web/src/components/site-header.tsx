import Link from 'next/link';
import { api, type CategoryNode } from '@/lib/api';
import { CartBadge } from '@/components/cart-badge';

async function getNav(): Promise<CategoryNode[]> {
  try {
    const tree = await api.categories();
    return tree.filter((c) => c.showInMenu).slice(0, 8);
  } catch {
    return [];
  }
}

export async function SiteHeader() {
  const nav = await getNav();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-sand)] bg-[var(--color-paper)]/90 backdrop-blur">
      <div className="bg-[var(--color-ink)] text-center text-xs tracking-wide text-[var(--color-bone)]">
        <p className="py-2">Free shipping over ₹999 · Easy 7-day returns · COD available</p>
      </div>
      <div className="container-wide flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-display text-2xl font-semibold">
          Slay<span className="text-[var(--color-accent)]">Jeans</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {nav.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
            >
              {c.name}
            </Link>
          ))}
          <Link href="/collections/sale" className="font-semibold text-[var(--color-sale)]">
            Sale
          </Link>
        </nav>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/search" aria-label="Search" className="hover:text-[var(--color-accent)]">
            Search
          </Link>
          <Link href="/account/orders" aria-label="Account" className="hover:text-[var(--color-accent)]">
            Account
          </Link>
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
