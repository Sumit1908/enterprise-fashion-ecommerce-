import Link from 'next/link';
import { api, type HomeResponse, type ProductCard } from '@/lib/api';
import { HeroSlider } from '@/components/home/hero-slider';
import { TrustBar } from '@/components/home/trust-bar';
import { CategoryShowcase } from '@/components/home/category-showcase';
import { ProductRail } from '@/components/home/product-rail';
import { ShopByFit } from '@/components/home/shop-by-fit';
import { BrandStory } from '@/components/home/brand-story';
import { WhyVelor } from '@/components/home/why-velor';
import { Testimonials } from '@/components/home/testimonials';
import { Newsletter } from '@/components/home/newsletter';

export const revalidate = 30;

function sectionByType(home: HomeResponse, type: string) {
  return home.sections.find((s) => s.type === type);
}

function take(source: ProductCard[], count: number, exclude = new Set<string>()) {
  const out: ProductCard[] = [];
  for (const p of source) {
    if (out.length >= count) break;
    if (!exclude.has(p.id) && !out.some((o) => o.id === p.id)) out.push(p);
  }
  for (const p of source) {
    if (out.length >= count) break;
    if (!out.some((o) => o.id === p.id)) out.push(p);
  }
  return out;
}

export default async function HomePage() {
  const [home, latest, best] = await Promise.all([
    api.home().catch(() => null),
    api.products('sort=latest&pageSize=12').then((r) => r.items).catch(() => [] as ProductCard[]),
    api.products('sort=bestselling&pageSize=12').then((r) => r.items).catch(() => [] as ProductCard[]),
  ]);

  if (!home) {
    return (
      <div className="container-wide py-32 text-center">
        <h1 className="font-display text-3xl">Storefront is warming up</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          The API isn&apos;t reachable yet. Start it with <code>pnpm dev</code> and seed the database
          with <code>pnpm db:seed</code>.
        </p>
      </div>
    );
  }

  const heroSlides = home.banners.filter((b) => b.placement === 'HOME_HERO' && b.imageUrl);
  const catTiles = sectionByType(home, 'CATEGORY_GRID')?.tiles ?? [];
  const pool = latest.length ? latest : best;

  const newArrivals = take(
    [...pool.filter((p) => p.isNewArrival), ...pool],
    4,
  );
  const naIds = new Set(newArrivals.map((p) => p.id));
  const bestSource = best.length ? best : pool;
  const bestSellers = take(bestSource, 4, naIds).length >= 3 ? take(bestSource, 4, naIds) : take(bestSource, 4);

  const naSection = sectionByType(home, 'NEW_ARRIVALS');
  const bsSection = sectionByType(home, 'BEST_SELLERS');
  const tSection = sectionByType(home, 'TESTIMONIALS');
  const nSection = sectionByType(home, 'NEWSLETTER');

  return (
    <>
      {heroSlides.length > 0 ? (
        <HeroSlider slides={heroSlides} />
      ) : (
        <section className="container-wide py-24">
          <h1 className="font-display text-4xl">Velor House</h1>
        </section>
      )}

      <TrustBar />

      <CategoryShowcase tiles={catTiles} />

      <ProductRail
        eyebrow="Just landed"
        title={naSection?.title || 'New Arrivals'}
        description={naSection?.subtitle || 'The newest pieces across menswear, womenswear and kids.'}
        ctaLabel={naSection?.ctaLabel || 'View all'}
        ctaHref={naSection?.ctaUrl || '/collections/new-arrivals'}
        products={newArrivals}
        priority
      />

      <ProductRail
        eyebrow="Tried & loved"
        title={bsSection?.title || 'Best Sellers'}
        description={bsSection?.subtitle || 'The styles our customers keep coming back for.'}
        ctaLabel={bsSection?.ctaLabel || 'Shop all'}
        ctaHref={bsSection?.ctaUrl || '/shop'}
        products={bestSellers}
        tone="paper"
      />

      <ShopByFit />

      <BrandStory />

      <WhyVelor />

      <Testimonials items={home.testimonials} title={tSection?.title} />

      <Newsletter title={nSection?.title} />

      {pool.length === 0 && (
        <div className="container-wide py-12 text-center text-sm text-[var(--color-ink-soft)]">
          <Link href="/shop" className="link-underline font-semibold">
            Browse the full catalogue
          </Link>
        </div>
      )}
    </>
  );
}
