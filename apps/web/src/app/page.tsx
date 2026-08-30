import Link from 'next/link';
import { api, type HomeResponse, type ProductCard } from '@/lib/api';
import { Hero } from '@/components/home/hero';
import { TrustBar } from '@/components/home/trust-bar';
import { CategoryShowcase } from '@/components/home/category-showcase';
import { ProductRail } from '@/components/home/product-rail';
import { EditorialCampaign } from '@/components/home/editorial-campaign';
import { ShopByFit } from '@/components/home/shop-by-fit';
import { BrandStory } from '@/components/home/brand-story';
import { WhySlay } from '@/components/home/why-slay';
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

  const hero = home.banners.find((b) => b.placement === 'HOME_HERO');
  const catTiles = sectionByType(home, 'CATEGORY_GRID')?.tiles ?? [];
  const pool = latest.length ? latest : best;

  const newArrivals = take(
    [...pool.filter((p) => p.isNewArrival), ...pool],
    4,
  );
  const naIds = new Set(newArrivals.map((p) => p.id));
  const bestSource = best.length ? best : pool;
  const bestSellers = take(bestSource, 4, naIds).length >= 3 ? take(bestSource, 4, naIds) : take(bestSource, 4);

  const campaignImage =
    pool.find((p) => /selvedge|indigo|premium/i.test(p.name))?.media[0]?.url ??
    pool[0]?.media[0]?.url ??
    hero?.imageUrl ??
    null;

  const naSection = sectionByType(home, 'NEW_ARRIVALS');
  const bsSection = sectionByType(home, 'BEST_SELLERS');
  const tSection = sectionByType(home, 'TESTIMONIALS');
  const nSection = sectionByType(home, 'NEWSLETTER');

  return (
    <>
      {hero ? (
        <Hero hero={hero} />
      ) : (
        <section className="container-wide py-24">
          <h1 className="font-display text-4xl">Slay Jeans</h1>
        </section>
      )}

      <TrustBar />

      <CategoryShowcase tiles={catTiles} />

      <ProductRail
        eyebrow="Just landed"
        title={naSection?.title || 'New Arrivals'}
        description={naSection?.subtitle || 'The latest washes and fits, fresh off the line.'}
        ctaLabel={naSection?.ctaLabel || 'View all'}
        ctaHref={naSection?.ctaUrl || '/collections/new-arrivals'}
        products={newArrivals}
        priority
      />

      <EditorialCampaign image={campaignImage} />

      <ProductRail
        eyebrow="Tried & loved"
        title={bsSection?.title || 'Best Sellers'}
        description={bsSection?.subtitle || 'The pairs our clients keep coming back for.'}
        ctaLabel={bsSection?.ctaLabel || 'Shop all denim'}
        ctaHref={bsSection?.ctaUrl || '/shop'}
        products={bestSellers}
        tone="paper"
      />

      <ShopByFit pool={pool} />

      <BrandStory />

      <WhySlay />

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
