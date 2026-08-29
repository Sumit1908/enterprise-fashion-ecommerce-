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
    const category = (await api.category(slug)) as { name: string; seo?: { metaTitle?: string; metaDescription?: string } };
    return {
      title: category.seo?.metaTitle ?? category.name,
      description: category.seo?.metaDescription ?? `Shop ${category.name} at Slay Jeans.`,
    };
  } catch {
    return { title: 'Category' };
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  let category: { name: string; description: string | null; bannerUrl?: string | null; seoContent?: string | null };
  try {
    category = (await api.category(slug)) as typeof category;
  } catch {
    notFound();
  }

  const qs = new URLSearchParams({ category: slug, page: sp.page ?? '1' });
  if (sp.sort) qs.set('sort', sp.sort);
  if (sp.brand) qs.set('brand', sp.brand);
  if (sp.minPrice) qs.set('minPrice', sp.minPrice);
  if (sp.maxPrice) qs.set('maxPrice', sp.maxPrice);
  if (sp.gender) qs.set('gender', sp.gender);
  if (sp.inStock) qs.set('inStock', 'true');

  const { items, pagination } = await api.products(qs.toString());

  return (
    <div className="container-wide py-10">
      <nav className="text-xs text-[var(--color-ink-soft)]">
        <Link href="/">Home</Link> / <span>{category.name}</span>
      </nav>
      <header className="mt-3 border-b border-[var(--color-sand)] pb-6">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{category.name}</h1>
        {category.description && (
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-soft)]">
            {category.description}
          </p>
        )}
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">{pagination.total} products</p>
        <div className="flex gap-2 overflow-x-auto text-sm hide-scrollbar">
          {SORTS.map(([value, label]) => (
            <Link
              key={value}
              href={`/c/${slug}?${qsFrom(sp, { sort: value })}`}
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

      {items.length === 0 ? (
        <p className="py-24 text-center text-[var(--color-ink-soft)]">
          No products match these filters yet.
        </p>
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
                href={`/c/${slug}?${qsFrom(sp, { page })}`}
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

      {category.seoContent && (
        <div
          className="prose mt-16 max-w-3xl text-sm text-[var(--color-ink-soft)]"
          dangerouslySetInnerHTML={{ __html: category.seoContent }}
        />
      )}
    </div>
  );
}
