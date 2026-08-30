import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const c = await api.collection(slug);
    return { title: c.name, description: c.description ?? `Shop the ${c.name} collection at Slay Jeans.` };
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
  if (sp.sort) qs.set('sort', sp.sort);

  const { items, pagination } = await api.products(qs.toString());

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

      {pagination.total > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-ink-soft)]">{pagination.total} products</p>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto text-sm">
            {SORTS.map(([value, label]) => (
              <Link
                key={value}
                href={`/collections/${slug}?${qsFrom(sp, { sort: value })}`}
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
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-[var(--color-ink-soft)]">Nothing in this collection right now.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium underline">
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
