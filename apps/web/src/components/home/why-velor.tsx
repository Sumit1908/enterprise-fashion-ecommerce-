import { SectionHeader } from '@/components/ui/section-header';
import { Reveal } from '@/components/ui/reveal';

const PILLARS: { title: string; body: string }[] = [
  {
    title: 'Considered design',
    body: 'Denim, shirts, shoes and accessories for the whole family — every silhouette refined over repeated wear-tests before it reaches the site.',
  },
  {
    title: 'Honest materials',
    body: 'Long-staple cottons, real leather and linen, mid-weight denim with the right recovery. No shortcuts in the cloth.',
  },
  {
    title: 'Limited runs',
    body: 'Made in small batches so we can keep the quality high. When a style sells through, we move on rather than reprint it.',
  },
  {
    title: 'Easy exchanges',
    body: 'Free shipping over ₹999, seven-day returns and Cash on Delivery across India. Shopping online should feel low-risk.',
  },
];

export function WhyVelor() {
  return (
    <section className="container-wide py-16 lg:py-20">
      <SectionHeader eyebrow="Why Velor House" title="Fashion, done properly" />
      <div className="grid gap-px overflow-hidden border border-[var(--color-sand)] bg-[var(--color-sand)] sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar, i) => (
          <Reveal key={pillar.title} delay={i * 70} className="bg-[var(--color-bone)] p-7 lg:p-8">
            <p className="font-display text-4xl text-[var(--color-accent)]">0{i + 1}</p>
            <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.1em]">{pillar.title}</h3>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-[var(--color-ink-soft)]">
              {pillar.body}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
