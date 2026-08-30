import { SectionHeader } from '@/components/ui/section-header';
import { Reveal } from '@/components/ui/reveal';
import { ProductCard } from '@/components/product-card';
import type { ProductCard as Card } from '@/lib/api';

export function ProductRail({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  products,
  tone = 'bone',
  priority = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  products: Card[];
  tone?: 'bone' | 'paper';
  priority?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className={tone === 'paper' ? 'bg-[var(--color-paper)]' : ''}>
      <div className="container-wide py-16 lg:py-20">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          ctaLabel={ctaLabel}
          ctaHref={ctaHref}
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 70}>
              <ProductCard product={p} priority={priority && i === 0} />
            </Reveal>
          ))}
        </div>
        {ctaLabel && ctaHref && (
          <div className="mt-12 text-center sm:hidden">
            <a
              href={ctaHref}
              className="link-underline text-xs font-semibold uppercase tracking-[0.16em]"
            >
              {ctaLabel}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
