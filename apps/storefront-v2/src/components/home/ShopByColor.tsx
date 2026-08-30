'use client';

import Link from 'next/link';
import { COLORS } from '@/lib/data/colors';

export function ShopByColor() {
  return (
    <section className="container-page section-gap">
      <div className="rounded-[var(--radius-img)] bg-[var(--color-gray-50)] px-5 py-9 sm:px-9 lg:px-12 lg:py-12">
        <p className="eyebrow mb-1.5 text-center">Find your shade</p>
        <h2 className="h-section text-center">Shop by Color</h2>
        <div className="hide-scrollbar mt-7 flex gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:justify-center md:overflow-visible">
          {COLORS.map((c) => (
            <Link
              key={c.name}
              href={`/shop?color=${c.name.toLowerCase()}`}
              className="pill shrink-0 border-[var(--color-border)] bg-white text-[12px] hover:border-[var(--color-ink)]"
            >
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ backgroundColor: c.hex }}
              />
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
