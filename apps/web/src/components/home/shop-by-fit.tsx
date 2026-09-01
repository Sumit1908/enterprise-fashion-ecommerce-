import Image from 'next/image';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';
import { Reveal } from '@/components/ui/reveal';
import { FITS } from '@/lib/fits';

export function ShopByFit() {
  // Curated, consistent denim imagery so the five tiles read as one set.
  const tiles = FITS;

  return (
    <section id="shop-by-fit" className="container-wide py-16 lg:py-20">
      <SectionHeader
        eyebrow="Find your fit"
        title="Shop Denim by Fit"
        description="Every silhouette we cut, from sculpted skinny to an architectural wide leg."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {tiles.map((tile, i) => (
          <Reveal key={tile.query} delay={i * 60}>
            <Link href={`/search?q=${tile.query}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-sand)]">
                <Image
                  src={tile.image}
                  alt={`${tile.label} fit jeans`}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover object-center transition-transform duration-[900ms] ease-out group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              </div>
              <p className="mt-3 font-display text-base">{tile.label}</p>
              <p className="text-[0.72rem] text-[var(--color-ink-soft)]">{tile.blurb}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
