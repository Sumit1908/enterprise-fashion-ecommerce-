import Image from 'next/image';
import Link from 'next/link';
import { discountPct, formatPrice, type ProductCard as Card } from '@/lib/api';

export function ProductCard({ product }: { product: Card }) {
  const pct = discountPct(product.mrp, product.salePrice);
  const image = product.media[0]?.url;

  return (
    <Link href={`/p/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[var(--color-sand)]">
        {image ? (
          <Image
            src={image}
            alt={product.media[0]?.alt ?? product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        {pct > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--color-sale)] px-2.5 py-1 text-xs font-semibold text-white">
            {pct}% OFF
          </span>
        )}
        {product.isNewArrival && (
          <span className="absolute right-3 top-3 rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-xs font-medium text-white">
            New
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {product.brand && (
          <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            {product.brand.name}
          </p>
        )}
        <h3 className="line-clamp-1 text-sm font-medium">{product.name}</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{formatPrice(product.salePrice, product.currency)}</span>
          {pct > 0 && (
            <span className="text-[var(--color-ink-soft)] line-through">
              {formatPrice(product.mrp, product.currency)}
            </span>
          )}
        </div>
        {product.ratingCount > 0 && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            ★ {product.ratingAverage.toFixed(1)} ({product.ratingCount})
          </p>
        )}
      </div>
    </Link>
  );
}
