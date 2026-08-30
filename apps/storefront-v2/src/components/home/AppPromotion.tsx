import Image from 'next/image';
import { Apple, Play } from 'lucide-react';
import { img, PHOTOS } from '@/lib/images';

const STATS = [
  { value: '10 Lakh+', label: 'Downloads' },
  { value: '4.6★', label: 'Rated' },
  { value: '6.8K', label: 'Reviews' },
];

export function AppPromotion() {
  return (
    <section className="container-page section-gap">
      <div className="grid overflow-hidden rounded-[var(--radius-img)] border border-[var(--color-border)] bg-[var(--color-offwhite)] lg:grid-cols-2">
        <div className="relative min-h-[280px] lg:min-h-[420px]">
          <Image
            src={img(PHOTOS.appPromo, 1200)}
            alt="SLAY JEANS campaign"
            fill
            sizes="(max-width:1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="flex items-center px-7 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <p className="eyebrow mb-1.5">Slay Jeans App</p>
            <h2 className="h-section">Download Our App</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Early access to drops, faster checkout and members-only pricing — in your pocket.
            </p>

            <dl className="mt-7 flex gap-8">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dd className="text-2xl font-black text-[var(--color-ink)]">{s.value}</dd>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>

            <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Available on
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href="#"
                aria-label="Get it on Google Play"
                className="inline-flex items-center gap-2.5 rounded-[10px] bg-[var(--color-ink)] px-4 py-2.5 text-white"
              >
                <Play className="h-5 w-5 fill-white" />
                <span className="text-left leading-tight">
                  <span className="block text-[9px] uppercase tracking-wide opacity-80">Get it on</span>
                  <span className="block text-[13px] font-bold">Google Play</span>
                </span>
              </a>
              <a
                href="#"
                aria-label="Download on the App Store"
                className="inline-flex items-center gap-2.5 rounded-[10px] bg-[var(--color-ink)] px-4 py-2.5 text-white"
              >
                <Apple className="h-5 w-5 fill-white" />
                <span className="text-left leading-tight">
                  <span className="block text-[9px] uppercase tracking-wide opacity-80">Download on the</span>
                  <span className="block text-[13px] font-bold">App Store</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
