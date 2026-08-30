import Link from 'next/link';
import Image from 'next/image';
import type { HomeResponse } from '@/lib/api';
import { ProductCard } from './product-card';

type Section = HomeResponse['sections'][number];
type Tile = { label: string | null; href: string; img: string | null };

function SectionHeading({ section }: { section: Section }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{section.title}</h2>
        {section.subtitle && (
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{section.subtitle}</p>
        )}
      </div>
      {section.ctaUrl && (
        <Link
          href={section.ctaUrl}
          className="shrink-0 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          {section.ctaLabel ?? 'View all'}
        </Link>
      )}
    </div>
  );
}

function ProductRail({ section }: { section: Section }) {
  if (section.products.length === 0) return null;
  return (
    <section className="container-wide py-12">
      <SectionHeading section={section} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {section.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

export function HomeSections({ data }: { data: HomeResponse }) {
  return (
    <>
      {data.sections.map((section) => {
        switch (section.type) {
          case 'BANNER':
            return null; // hero rendered separately at top of page
          case 'CATEGORY_GRID':
          case 'COLLECTION_GRID': {
            const tiles: Tile[] =
              section.type === 'COLLECTION_GRID'
                ? data.collections.map((c) => ({
                    label: c.name,
                    href: `/collections/${c.slug}`,
                    img: c.imageUrl ?? c.bannerUrl,
                  }))
                : section.tiles.map((t) => ({
                    label: t.label,
                    href: t.url ?? '#',
                    img: t.imageUrl,
                  }));
            if (tiles.length === 0) return null;
            return (
              <section key={section.id} className="container-wide py-12">
                <SectionHeading section={section} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {tiles.map(({ label, href, img }, i) => (
                    <Link
                      key={i}
                      href={href}
                      className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-lg bg-[var(--color-sand)] p-3 sm:p-4"
                    >
                      {img && (
                        <Image
                          src={img}
                          alt={label ?? ''}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                      <span className="relative z-10 text-sm font-semibold text-white drop-shadow">
                        {label}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }
          case 'TESTIMONIALS':
            return (
              <section key={section.id} className="bg-[var(--color-paper)] py-16">
                <div className="container-wide">
                  <SectionHeading section={section} />
                  <div className="grid gap-6 md:grid-cols-3">
                    {data.testimonials.map((t) => (
                      <figure key={t.id} className="rounded-xl border border-[var(--color-sand)] p-6">
                        <div className="text-[var(--color-accent)]">{'★'.repeat(t.rating)}</div>
                        <blockquote className="mt-3 text-sm text-[var(--color-ink-soft)]">
                          “{t.quote}”
                        </blockquote>
                        <figcaption className="mt-4 text-sm font-semibold">{t.authorName}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </section>
            );
          case 'NEWSLETTER':
            return (
              <section key={section.id} className="container-wide py-16">
                <div className="rounded-2xl bg-[var(--color-indigo)] px-6 py-14 text-center text-white">
                  <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                    {section.title ?? 'Join the list'}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
                    Early access to drops, members-only pricing and styling notes.
                  </p>
                  <form className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-md bg-white px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Subscribe
                    </button>
                  </form>
                </div>
              </section>
            );
          case 'INSTAGRAM':
            if (data.instagram.length === 0) return null;
            return (
              <section key={section.id} className="container-wide py-12">
                <SectionHeading section={section} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {data.instagram.map((post) => (
                    <a
                      key={post.id}
                      href={post.permalink}
                      className="relative aspect-square overflow-hidden rounded"
                    >
                      <Image src={post.imageUrl} alt="" fill sizes="16vw" className="object-cover" />
                    </a>
                  ))}
                </div>
              </section>
            );
          default:
            return <ProductRail key={section.id} section={section} />;
        }
      })}
    </>
  );
}
