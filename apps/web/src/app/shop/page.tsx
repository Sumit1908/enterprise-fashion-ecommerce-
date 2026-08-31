import type { Metadata } from 'next';
import Link from 'next/link';
import { api, type Facets } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';
import { SectionHeader } from '@/components/ui/section-header';

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata: Metadata = {
  title: 'Shop All',
  description: 'Browse the full Slay Jeans collection for Men, Women and Kids.',
};

const FILTER_KEYS = ['sort', 'brand', 'minPrice', 'maxPrice', 'gender', 'inStock', 'size', 'color', 'sub'] as const;

function qsFrom(sp: Record<string, string | undefined>, overrides: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v != null) clean[k] = v;
  return new URLSearchParams({ ...clean, ...overrides }).toString();
}

export default async function ShopPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '24' });
  for (const k of FILTER_KEYS) if (sp[k]) qs.set(k, sp[k]!);

  const [{ items, pagination }, facets] = await Promise.all([
    api.products(qs.toString()),
    api.facets(sp.gender ? `gender=${sp.gender}` : '').catch(
      (): Facets => ({ total: 0, sizes: [], colors: [], brands: [], subcategories: [], price: { min: 0, max: 0 } }),
    ),
  ]);

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
          title="Shop All"
          description={`${pagination.total} styles across Men, Women & Kids.`}
        />
      </div>

      <ProductFilters basePath="/shop" sp={sp} facets={facets} total={pagination.total} />

      {items.length === 0 ? (
        <p className="py-24 text-center text-[var(--color-ink-soft)]">
          No products match these filters. <Link href="/shop" className="underline">Clear filters</Link>
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
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
