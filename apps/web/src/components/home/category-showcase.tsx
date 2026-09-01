import Image from 'next/image';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { Reveal } from '@/components/ui/reveal';

export interface CategoryTile {
  label: string | null;
  imageUrl: string | null;
  url: string | null;
}

/**
 * Last-resort placeholder if a category has no image set in the admin. The
 * real images now come from the API (Category.imageUrl), editable under
 * Admin → Categories & Collections.
 */
const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

const FALLBACK: Record<string, string> = {
  '/c/men': IMG('1516257984-b1b4d707412e'),
  '/c/women': IMG('1495385794356-15371f348c31'),
  '/c/kids': IMG('1518831959646-742c3a14ebf7'),
};
const GENERIC_FALLBACK = IMG('1441984904996-e0b6ba687e04');

export function CategoryShowcase({ tiles }: { tiles: CategoryTile[] }) {
  const items = tiles.filter((t) => t.label && t.url).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="container-wide py-16 lg:py-20">
      <SectionHeader
        eyebrow="Wardrobe"
        title="Shop by Category"
        description="Menswear, womenswear and kids — organised the way you actually shop."
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {items.map((tile, i) => {
          const src = tile.imageUrl || FALLBACK[tile.url!] || GENERIC_FALLBACK;
          return (
            <Reveal key={tile.url} delay={i * 60}>
              <Link
                href={tile.url!}
                className="group relative block aspect-[4/5] overflow-hidden bg-[var(--color-sand)]"
              >
                {src && (
                  <Image
                    src={src}
                    alt={tile.label ?? ''}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-[900ms] ease-out group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 sm:p-5">
                  <span className="font-display text-lg text-[var(--color-bone)] sm:text-xl">
                    {tile.label}
                  </span>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-bone)]/80 transition-transform duration-300 group-hover:translate-x-1">
                    Shop →
                  </span>
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
