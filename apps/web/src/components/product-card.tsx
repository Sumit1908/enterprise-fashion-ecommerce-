import Image from 'next/image';
import Link from 'next/link';
import { discountPct, formatPrice, type ProductCard as Card } from '@/lib/api';
import { WishlistButton } from './wishlist-button';
import { QuickAdd } from './quick-add';

export function ProductCard({
  product,
  priority = false,
}: {
  product: Card;
  priority?: boolean;
}) {
  const pct = discountPct(product.mrp, product.salePrice);
  const primary = product.media[0]?.url;
  const secondary = product.media[1]?.url;
  const rating = product.ratingCount > 0 ? product.ratingAverage : 0;

  return (
    <div className="group flex flex-col">
      <div className="relative overflow-hidden bg-[var(--color-sand)]">
        <Link href={`/p/${product.slug}`} className="block" aria-label={product.name}>
          <div className="relative aspect-[4/5]">
            {primary && (
              <Image
                src={primary}
                alt={product.media[0]?.alt ?? product.name}
                fill
                priority={priority}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover object-top transition-[opacity,transform] duration-700 ease-out ${
                  secondary
                    ? 'group-hover:opacity-0'
                    : 'group-hover:scale-[1.04]'
                }`}
              />
            )}
            {secondary && (
              <Image
                src={secondary}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover object-top opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
              />
            )}
          </div>
        </Link>

        {/* Badges — understated, no filled red */}
        <div className="pointer-events-none absolute left-0 top-0 flex flex-col items-start gap-1.5 p-3">
          {product.isNewArrival && (
            <span className="bg-[var(--color-ink)] px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white">
              New
            </span>
          )}
          {pct > 0 && (
            <span className="bg-[var(--color-paper)]/90 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-sale)]">
              {pct}% off
            </span>
          )}
        </div>

        <WishlistButton
          slug={product.slug}
          className="absolute right-3 top-3 opacity-100 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100 lg:opacity-0"
        />

        {/* Quick add — desktop hover only */}
        <div className="absolute inset-x-0 bottom-0 hidden translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0 lg:block">
          <QuickAdd slug={product.slug} productName={product.name} />
        </div>
      </div>

      <Link href={`/p/${product.slug}`} className="mt-3.5 flex flex-1 flex-col">
        {product.brand && (
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-mute)]">
            {product.brand.name}
          </p>
        )}
        <h3 className="mt-1 line-clamp-1 text-sm text-[var(--color-ink)]">{product.name}</h3>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[var(--color-ink)]">
            {formatPrice(product.salePrice, product.currency)}
          </span>
          {pct > 0 && (
            <span className="text-xs text-[var(--color-ink-mute)] line-through">
              {formatPrice(product.mrp, product.currency)}
            </span>
          )}
        </div>

        {rating > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-[0.7rem] text-[var(--color-ink-soft)]">
            <span className="text-[var(--color-accent)]">★</span>
            {rating.toFixed(1)}
            <span className="text-[var(--color-ink-mute)]">({product.ratingCount})</span>
          </p>
        )}
      </Link>
    </div>
  );
}
