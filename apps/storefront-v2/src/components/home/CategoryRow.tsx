import { CategoryCard } from '@/components/ui/CategoryCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { CategoryCardData } from '@/lib/data/categories';

export function CategoryRow({
  title,
  eyebrow,
  items,
  ctaHref = '/shop',
}: {
  title: string;
  eyebrow?: string;
  items: CategoryCardData[];
  ctaHref?: string;
}) {
  return (
    <section className="container-page section-gap">
      <SectionHeading title={title} eyebrow={eyebrow} ctaLabel="View All" ctaHref={ctaHref} />
      <div className="hide-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-5 xl:grid-cols-7">
        {items.map((item) => (
          <CategoryCard
            key={item.label}
            item={item}
            className="w-[46%] shrink-0 sm:w-[30%] md:w-auto"
          />
        ))}
      </div>
    </section>
  );
}
