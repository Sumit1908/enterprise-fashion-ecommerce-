import { Reveal } from '@/components/ui/reveal';
import { NewsletterForm } from '@/components/newsletter-form';

export function Newsletter({ title }: { title?: string | null }) {
  return (
    <section className="bg-[var(--color-ink)] text-[var(--color-bone)]">
      <div className="container-wide py-20 text-center lg:py-24">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow text-[var(--color-accent-soft)]">The List</p>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl">
            {title || 'First access to every drop'}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-[var(--color-bone)]/70">
            Early looks at new washes, restock alerts and styling notes. Considered emails only —
            no noise.
          </p>
          <NewsletterForm />
        </Reveal>
      </div>
    </section>
  );
}
