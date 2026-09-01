import { Reveal } from '@/components/ui/reveal';
import { NewsletterForm } from '@/components/newsletter-form';

export function Newsletter({ title }: { title?: string | null }) {
  return (
    <section id="the-list" className="scroll-mt-24 bg-[var(--color-ink)] text-[var(--color-bone)]">
      <div className="container-wide py-20 text-center lg:py-24">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow text-[var(--color-accent-soft)]">The List</p>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl">
            {title || 'Join the Velor House list'}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-[var(--color-bone)]/70">
            Be the first to discover new arrivals, seasonal collections and exclusive offers.
            Considered emails only — no noise.
          </p>
          <NewsletterForm source="homepage" />
        </Reveal>
      </div>
    </section>
  );
}
