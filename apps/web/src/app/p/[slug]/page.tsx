import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, discountPct, formatPrice, type ProductDetail } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { AddToCart } from '@/components/add-to-cart';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await api.product(slug);
    return {
      title: p.name,
      description: p.shortDescription ?? undefined,
      openGraph: { images: p.media[0]?.url ? [p.media[0].url] : [] },
    };
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  let product: ProductDetail;
  try {
    product = await api.product(slug);
  } catch {
    notFound();
  }

  const pct = discountPct(product.mrp, product.salePrice);
  const inStock = product.variants.some(
    (v) => v.inventory.reduce((sum, i) => sum + (i.onHand - i.reserved), 0) > 0,
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.media.map((m) => m.url),
    description: product.shortDescription ?? product.name,
    brand: product.brand?.name,
    aggregateRating:
      product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      price: Number(product.salePrice),
      priceCurrency: product.currency,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  const gallery = product.media.slice(0, 6);

  return (
    <div className="container-wide py-6 pb-24 sm:py-10 lg:pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-ink-soft)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">
          Home
        </Link>
        {product.categories[0] && (
          <>
            <span aria-hidden>/</span>
            <Link
              href={`/c/${product.categories[0].category.slug}`}
              className="hover:text-[var(--color-ink)]"
            >
              {product.categories[0].category.name}
            </Link>
          </>
        )}
        <span aria-hidden>/</span>
        <span className="text-[var(--color-ink)]">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {gallery.map((m, i) => (
            <div
              key={i}
              className={`relative overflow-hidden rounded-lg bg-[var(--color-sand)] ${
                gallery.length > 1 && i === 0 ? 'sm:col-span-2' : ''
              } aspect-[4/5]`}
            >
              <Image
                src={m.url}
                alt={m.alt ?? product.name}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          {product.brand && (
            <p className="text-sm uppercase tracking-wide text-[var(--color-ink-soft)]">
              {product.brand.name}
            </p>
          )}
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{product.name}</h1>

          {product.ratingCount > 0 && (
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              <span className="text-[var(--color-accent)]">★</span> {product.ratingAverage.toFixed(1)}
              {product.ratingCount > 0 ? ` (${product.ratingCount})` : ''}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-semibold">
              {formatPrice(product.salePrice, product.currency)}
            </span>
            {pct > 0 && (
              <>
                <span className="text-[var(--color-ink-soft)] line-through">
                  {formatPrice(product.mrp, product.currency)}
                </span>
                <span className="rounded bg-[var(--color-sale)]/10 px-2 py-0.5 text-sm font-semibold text-[var(--color-sale)]">
                  {pct}% off
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Inclusive of all taxes</p>

          <AddToCart product={product} />

          <div className="mt-8 space-y-4 border-t border-[var(--color-sand)] pt-6 text-sm">
            {product.description && (
              <div dangerouslySetInnerHTML={{ __html: product.description }} />
            )}
            {product.fabricDetails && (
              <p>
                <span className="font-medium">Fabric:</span> {product.fabricDetails}
              </p>
            )}
            {product.careInstructions && (
              <p>
                <span className="font-medium">Care:</span> {product.careInstructions}
              </p>
            )}
            {product.attributes.length > 0 && (
              <dl className="grid grid-cols-2 gap-2">
                {product.attributes.map((a) => (
                  <div key={a.attribute.name}>
                    <dt className="text-[var(--color-ink-soft)]">{a.attribute.name}</dt>
                    <dd>{a.value}{a.attribute.unit ? ` ${a.attribute.unit}` : ''}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="rounded-lg bg-[var(--color-paper)] p-4 text-xs text-[var(--color-ink-soft)]">
              Free shipping over ₹999 · Easy 7-day returns · Cash on Delivery available
            </div>
          </div>
        </div>
      </div>

      {product.relatedFrom.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {product.relatedFrom.map((r) => (
              <ProductCard key={r.target.id} product={r.target} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
