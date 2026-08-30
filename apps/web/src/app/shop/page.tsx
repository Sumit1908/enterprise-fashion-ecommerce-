import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { SectionHeader } from '@/components/ui/section-header';

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata: Metadata = {
  title: 'Shop All',
  description: 'Every pair of Slay Jeans denim — browse the full catalogue.',
};

const SORTS: [string, string][] = [
  ['latest', 'Latest'],
  ['popular', 'Popular'],
  ['bestselling', 'Best Selling'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['rating', 'Highest Rated'],
];

function qsFrom(sp: Record<string, string | undefined>, overrides: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v != null) clean[k] = v;
  return new URLSearchParams({ ...clean, ...overrides }).toString();
}

export default async function ShopPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '24' });
  if (sp.sort) qs.set('sort', sp.sort);

  const { items, pagination } = await api.products(qs.toString());

  return (
    <div className="container-wide py-12 lg:py-16">
      <nav className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-ink-soft)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">Home</Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-ink)]">Shop All</span>
      </nav>

      <div className="mt-4">
        <SectionHeader
          eyebrow="The full collection"
          title="Shop All Denim"
          description={`${pagination.total} styles — slim to wide leg, raw to vintage wash.`}
        />
      </div>

      <div className="hide-scrollbar -mt-4 mb-8 flex gap-2 overflow-x-auto text-sm">
        {SORTS.map(([value, label]) => (
          <Link
            key={value}
            href={`/shop?${qsFrom(sp, { sort: value, page: '1' })}`}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 ${
              sp.sort === value
                ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                : 'border-[var(--color-sand)]'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-24 text-center text-[var(--color-ink-soft)]">Nothing to show yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-14 flex justify-center gap-2 text-sm">
          {Array.from({ length: pagination.totalPages }).map((_, i) => {
            const page = String(i + 1);
            return (
              <Link
                key={page}
                href={`/shop?${qsFrom(sp, { page })}`}
                className={`rounded-md border px-3.5 py-2 ${
                  (sp.page ?? '1') === page
                    ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                    : 'border-[var(--color-sand)]'
                }`}
              >
                {page}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
