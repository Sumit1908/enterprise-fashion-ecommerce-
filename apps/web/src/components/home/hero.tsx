import Image from 'next/image';
import Link from 'next/link';
import type { HomeResponse } from '@/lib/api';

type Banner = HomeResponse['banners'][number];

export function Hero({ hero }: { hero: Banner }) {
  return (
    <section className="relative flex min-h-[86vh] items-end overflow-hidden sm:min-h-[92vh]">
      {hero.imageUrl && (
        <Image
          src={hero.imageUrl}
          alt={hero.headline ?? hero.title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-black/55 to-transparent sm:block" />

      <div className="container-wide relative z-10 pb-16 pt-28 text-[var(--color-bone)] sm:pb-24">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-soft)]">
          {hero.title}
        </p>
        <h1 className="mt-5 max-w-[52rem] text-balance font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem]">
          {hero.headline}
        </h1>
        {hero.subheadline && (
          <p className="mt-5 max-w-md text-base text-[var(--color-bone)]/85 sm:text-lg">
            {hero.subheadline}
          </p>
        )}
        <div className="mt-9 flex flex-wrap items-center gap-6">
          {hero.ctaUrl && (
            <Link href={hero.ctaUrl} className="btn btn-light">
              {hero.ctaLabel ?? 'Shop now'}
            </Link>
          )}
          <Link
            href="/shop"
            className="link-underline text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-bone)]"
          >
            Explore all denim
          </Link>
        </div>
      </div>
    </section>
  );
}
