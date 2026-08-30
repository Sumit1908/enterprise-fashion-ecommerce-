import Link from 'next/link';
import { POPULAR_SEARCHES } from '@/lib/data/popularSearches';

function slug(s: string) {
  return `/shop?q=${encodeURIComponent(s.toLowerCase())}`;
}

export function PopularSearches() {
  return (
    <section className="border-t border-[var(--color-border)] bg-[var(--color-offwhite)]">
      <div className="container-page section-gap">
        <h2 className="h-section text-center">Popular Searches</h2>
        <div className="mt-9 grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {POPULAR_SEARCHES.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-ink)]">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href={slug(l)}
                      className="text-[12.5px] leading-snug text-[var(--color-text-muted)] hover:text-[var(--color-ink)]"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
