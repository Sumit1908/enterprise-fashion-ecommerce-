'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, Star } from 'lucide-react';
import { useStore } from '@/lib/store';
import { discountPct, formatINR, type Product } from '@/lib/data/products';

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { toggleWishlist, isWished, addToCart } = useStore();
  const [popped, setPopped] = useState(false);
  const pct = discountPct(product);
  const wished = isWished(product.id);
  const isNew = product.tags.includes('new');

  function onHeart(e: React.MouseEvent) {
    e.preventDefault();
    toggleWishlist(product.id);
    setPopped(true);
    setTimeout(() => setPopped(false), 340);
  }

  function onAdd(e: React.MouseEvent) {
    e.preventDefault();
    addToCart(product.id);
  }

  return (
    <div className="group flex flex-col">
      <div className="relative overflow-hidden rounded-[var(--radius-img)] bg-[var(--color-gray-50)]">
        <Link href={`/product/${product.slug}`} aria-label={product.name} className="block">
          <div className="relative aspect-[4/5]">
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              priority={priority}
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
              className="object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-0"
            />
            <Image
              src={product.images[1]}
              alt=""
              fill
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
              className="object-cover opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
            />
          </div>
        </Link>

        {/* badges */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {pct > 0 && (
            <span className="rounded-full bg-[var(--color-red)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              {pct}% Off
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-[var(--color-ink)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              New
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onHeart}
          aria-pressed={wished}
          aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
          className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[var(--color-ink)] shadow-sm transition hover:bg-white"
        >
          <Heart
            className={`h-[17px] w-[17px] ${popped ? 'animate-pop' : ''} ${
              wished ? 'fill-[var(--color-red)] text-[var(--color-red)]' : ''
            }`}
          />
        </button>

        {/* quick add — visible on hover (desktop), always on touch */}
        <div className="absolute inset-x-2.5 bottom-2.5 translate-y-[130%] opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 max-lg:translate-y-0 max-lg:opacity-100">
          <button
            type="button"
            onClick={onAdd}
            className="btn btn-dark w-full rounded-[12px] py-3 text-[13px]"
          >
            Add to Cart
          </button>
        </div>
      </div>

      <Link href={`/product/${product.slug}`} className="mt-3 flex flex-col">
        <h3 className="line-clamp-1 text-[13.5px] font-semibold text-[var(--color-ink)]">
          {product.name}
        </h3>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13.5px] font-bold text-[var(--color-ink)]">
            {formatINR(product.price)}
          </span>
          {pct > 0 && (
            <>
              <span className="text-[12px] text-[var(--color-text-muted)] line-through">
                {formatINR(product.mrp)}
              </span>
              <span className="text-[12px] font-semibold text-[var(--color-red)]">{pct}% off</span>
            </>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
          <Star className="h-3 w-3 fill-[var(--color-navy)] text-[var(--color-navy)]" />
          {product.rating.toFixed(1)}
          <span>({product.ratingCount})</span>
        </div>
      </Link>

      <div className="mt-2 flex items-center gap-1.5">
        {product.colors.slice(0, 5).map((c) => (
          <span
            key={c.name}
            title={c.name}
            className="h-3.5 w-3.5 rounded-full border border-[var(--color-border)]"
            style={{ backgroundColor: c.hex }}
          />
        ))}
        {product.colors.length > 5 && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            +{product.colors.length - 5}
          </span>
        )}
      </div>
    </div>
  );
}
