import Image from 'next/image';
import Link from 'next/link';
import { img, PHOTOS } from '@/lib/images';

export function DenimBanner() {
  return (
    <section className="container-page section-gap">
      <div className="grid overflow-hidden rounded-[var(--radius-img)] bg-[var(--color-navy)] text-white lg:grid-cols-2">
        <div className="relative min-h-[320px] lg:min-h-[460px]">
          <Image
            src={img(PHOTOS.campaignDenim, 1400)}
            alt="Close-up of raw indigo denim"
            fill
            sizes="(max-width:1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="flex items-center px-7 py-12 sm:px-12 lg:px-16">
          <div className="max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
              The Denim Study
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase leading-[1.05] sm:text-4xl lg:text-5xl">
              Denim That Keeps Up
            </h2>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-white/75">
              With You, Everyday
            </p>
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              Mid-weight stretch that moves, rigid selvedge that lasts, honest washes that fade to
              your life. Every fit wear-tested before it reaches you.
            </p>
            <Link
              href="/shop?c=jeans"
              className="btn btn-red mt-8 rounded-[12px] px-8 py-3.5 text-[13px] uppercase tracking-[0.14em]"
            >
              Shop Denim
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
