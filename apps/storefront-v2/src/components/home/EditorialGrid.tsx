import Image from 'next/image';
import Link from 'next/link';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { CategoryCardData } from '@/lib/data/categories';

export function EditorialGrid({
  title,
  eyebrow,
  items,
  columns = 3,
}: {
  title: string;
  eyebrow?: string;
  items: CategoryCardData[];
  columns?: 3 | 6;
}) {
  return (
    <section className="container-page section-gap">
      <SectionHeading title={title} eyebrow={eyebrow} />
      <div
        className={`hide-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:overflow-visible md:px-0 ${
          columns === 6
            ? 'md:grid-cols-3 lg:grid-cols-6'
            : 'md:grid-cols-3'
        }`}
      >
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group block w-[72%] shrink-0 sm:w-[45%] md:w-auto"
          >
            <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-img)] bg-[var(--color-gray-50)]">
              <Image
                src={item.image}
                alt={item.label}
                fill
                sizes="(max-width:768px) 72vw, 33vw"
                className="object-cover transition-transform duration-[700ms] ease-out group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <span className="absolute bottom-3 left-4 text-[15px] font-black uppercase tracking-[0.1em] text-white">
                {item.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
