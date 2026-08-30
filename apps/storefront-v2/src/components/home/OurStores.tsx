import Image from 'next/image';
import { MapPin, Phone } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { STORES } from '@/lib/data/stores';

export function OurStores() {
  return (
    <section className="container-page section-gap">
      <SectionHeading title="Our Stores" eyebrow="Come say hi" ctaLabel="View All" ctaHref="/stores" />
      <div className="hide-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-6 lg:px-0">
        {STORES.map((s) => (
          <article
            key={s.city}
            className="w-[64%] shrink-0 overflow-hidden rounded-[var(--radius-img)] border border-[var(--color-border)] bg-white sm:w-[40%] lg:w-auto"
          >
            <div className="relative aspect-[4/3] bg-[var(--color-gray-50)]">
              <Image
                src={s.image}
                alt={`SLAY JEANS store, ${s.city}`}
                fill
                sizes="(max-width:1024px) 64vw, 16vw"
                className="object-cover"
              />
            </div>
            <div className="p-3.5">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em]">
                Slay Jeans — {s.city}
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-[var(--color-text-muted)]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {s.address}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {s.phone}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
