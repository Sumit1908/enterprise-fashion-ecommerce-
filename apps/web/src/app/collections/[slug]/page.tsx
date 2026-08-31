import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, type Facets } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const FILTER_KEYS = ['sort', 'brand', 'minPrice', 'maxPrice', 'gender', 'inStock', 'size', 'color', 'sub'] as const;

function qsFrom(sp: Record<string, string | undefined>, overrides: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v != null) clean[k] = v;
  return new URLSearchParams({ ...clean, ...overrides }).toString();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const c = await api.collection(slug);
    return { title: c.name, description: c.description ?? `Shop the ${c.name} collection at Velor House.` };
  } catch {
    return { title: 'Collection' };
  }
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  let collection: Awaited<ReturnType<typeof api.collection>>;
  try {
    collection = await api.collection(slug);
  } catch {
    notFound();
  }

  const qs = new URLSearchParams({ collection: slug, page: sp.page ?? '1' });
  for (const k of FILTER_KEYS) if (sp[k]) qs.set(k, sp[k]!);

  const [{ items, pagination }, facets] = await Promise.all([
    api.products(qs.toString()),
    api.facets(`collection=${slug}`).catch(
      (): Facets => ({ total: 0, sizes: [], colors: [], brands: [], subcategories: [], price: { min: 0, max: 0 } }),
    ),
  ]);

  return (
    <div className="container-wide py-10">
      <nav className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-ink-soft)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-ink)]">{collection.name}</span>
      </nav>

      <header className="mt-4 border-b border-[var(--color-sand)] pb-8">
        <p className="eyebrow">Collection</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">{collection.name}</h1>
        {collection.description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-ink-soft)]">{collection.description}</p>
        )}
      </header>

      {(pagination.total > 0 || Object.keys(sp).some((k) => (FILTER_KEYS as readonly string[]).includes(k))) && (
        <ProductFilters basePath={`/collections/${slug}`} sp={sp} facets={facets} total={pagination.total} />
      )}

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-[var(--color-ink-soft)]">Nothing in this collection right now.</p>
          <Link href="/shop" className="mt-4 inline-block text-sm font-medium underline">
            Browse everything
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-12 flex justify-center gap-2 text-sm">
          {Array.from({ length: pagination.totalPages }).map((_, i) => {
            const page = String(i + 1);
            return (
              <Link
                key={page}
                href={`/collections/${slug}?${qsFrom(sp, { page })}`}
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
