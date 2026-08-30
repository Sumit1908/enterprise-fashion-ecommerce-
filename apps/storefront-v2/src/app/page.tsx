import { HeroCarousel } from '@/components/home/HeroCarousel';
import { ShopByPills } from '@/components/home/ShopByPills';
import { BestsellerSection } from '@/components/home/BestsellerSection';
import { CategoryRow } from '@/components/home/CategoryRow';
import { DenimBanner } from '@/components/home/DenimBanner';
import { ShopByColor } from '@/components/home/ShopByColor';
import { EditorialGrid } from '@/components/home/EditorialGrid';
import { OurStores } from '@/components/home/OurStores';
import { AppPromotion } from '@/components/home/AppPromotion';
import { PopularSearches } from '@/components/home/PopularSearches';
import { TOP_WEAR, BOTTOM_WEAR, AESTHETICS, OCCASIONS } from '@/lib/data/categories';

export default function HomePage() {
  return (
    <>
      <HeroCarousel />
      <ShopByPills />

      <div id="bestsellers" className="scroll-mt-40">
        <BestsellerSection />
      </div>

      <CategoryRow title="Top Wear" eyebrow="Layer up" items={TOP_WEAR} ctaHref="/shop?c=topwear" />
      <CategoryRow
        title="Bottom Wear"
        eyebrow="Built from the ground up"
        items={BOTTOM_WEAR}
        ctaHref="/shop?c=bottomwear"
      />

      <DenimBanner />

      <ShopByColor />

      <EditorialGrid
        title="Shop by Aesthetics"
        eyebrow="Your look, your rules"
        items={AESTHETICS}
        columns={3}
      />
      <EditorialGrid
        title="Shop by Occasions"
        eyebrow="Dressed for the day"
        items={OCCASIONS}
        columns={6}
      />

      <OurStores />
      <AppPromotion />
      <PopularSearches />
    </>
  );
}
