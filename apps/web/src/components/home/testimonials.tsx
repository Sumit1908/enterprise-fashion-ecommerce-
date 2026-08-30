import { SectionHeader } from '@/components/ui/section-header';
import { Reveal } from '@/components/ui/reveal';
import type { HomeResponse } from '@/lib/api';

export function Testimonials({
  items,
  title,
}: {
  items: HomeResponse['testimonials'];
  title?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section className="bg-[var(--color-paper)]">
      <div className="container-wide py-16 lg:py-20">
        <SectionHeader eyebrow="From our clients" title={title || 'What people are saying'} />
        <div className="grid gap-6 md:grid-cols-3">
          {items.slice(0, 3).map((t, i) => (
            <Reveal
              key={t.id}
              delay={i * 80}
              className="flex flex-col border border-[var(--color-sand)] bg-[var(--color-bone)] p-8"
            >
              <span className="font-display text-5xl leading-none text-[var(--color-accent)]">&ldquo;</span>
              <blockquote className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-[var(--color-ink)]">
                {t.quote}
              </blockquote>
              <div className="mt-6">
                <div className="text-sm text-[var(--color-accent)]">{'★'.repeat(Math.max(1, Math.min(5, t.rating)))}</div>
                <figcaption className="mt-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                  {t.authorName}
                </figcaption>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
