import type { Metadata } from 'next';
import Image from 'next/image';
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
  for (const k of FILTER_KEYS) if (sp[k]) qs.set(k, sp[k]!);

  const facetQs = new URLSearchParams({ category: slug });
  if (sp.gender) facetQs.set('gender', sp.gender);

  const [{ items, pagination }, facets] = await Promise.all([
    api.products(qs.toString()),
    api.facets(facetQs.toString()).catch(
      (): Facets => ({ total: 0, sizes: [], colors: [], brands: [], subcategories: [], price: { min: 0, max: 0 } }),
    ),
  ]);

  return (
    <div>
      {category.bannerUrl && (
        <div className="relative flex min-h-[36vh] items-end overflow-hidden bg-[var(--color-indigo-deep)] sm:min-h-[44vh]">
          <Image
            src={category.bannerUrl}
            alt={category.name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="container-wide relative z-10 pb-10 pt-24 text-[var(--color-bone)]">
            <p className="eyebrow text-[var(--color-accent-soft)]">Collection</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl">{category.name}</h1>
          </div>
        </div>
      )}
      <div className="container-wide py-10">
      <nav className="text-xs text-[var(--color-ink-soft)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">Home</Link> / <span>{category.name}</span>
      </nav>
      <header className="mt-4 border-b border-[var(--color-sand)] pb-8">
        {!category.bannerUrl && (
          <>
            <p className="eyebrow">Collection</p>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl">{category.name}</h1>
          </>
        )}
        {category.description && (
          <p className={`${category.bannerUrl ? '' : 'mt-3'} max-w-2xl text-sm leading-relaxed text-[var(--color-ink-soft)]`}>
            {category.description}
          </p>
        )}
      </header>

      <ProductFilters basePath={`/c/${slug}`} sp={sp} facets={facets} total={pagination.total} />

      {items.length === 0 ? (
        <p className="py-24 text-center text-[var(--color-ink-soft)]">
          No products match these filters. <Link href={`/c/${slug}`} className="underline">Clear filters</Link>
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
    </div>
  );
}
