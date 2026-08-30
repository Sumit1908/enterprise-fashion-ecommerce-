import Link from 'next/link';
import { Reveal } from '@/components/ui/reveal';

export function BrandStory() {
  return (
    <section className="bg-[var(--color-paper)]">
      <div className="container-wide py-20 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Our Philosophy</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-5xl">
            Made for the everyday icon
          </h2>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            Slay Jeans began with one idea: denim should be considered. The right weight, an
            honest wash, a fit that holds its shape from morning to midnight. Every pair is
            designed in-house and made in small, limited runs.
          </p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            When a run sells out, it is genuinely gone. We would rather cut a new pattern than
            repeat a mediocre one — so the quality stays high and the story stays clear.
          </p>
          <Link
            href="/pages/about"
            className="link-underline mt-8 inline-block text-xs font-semibold uppercase tracking-[0.16em]"
          >
            Read our story
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
