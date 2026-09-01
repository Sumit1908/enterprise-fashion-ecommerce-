import Link from 'next/link';
import { Reveal } from '@/components/ui/reveal';

export function BrandStory() {
  return (
    <section className="bg-[var(--color-paper)]">
      <div className="container-wide py-20 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Our Philosophy</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-5xl">
            Considered fashion, made to last
          </h2>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            Velor House began with one idea: everything you wear should be considered. The right
            fabric, an honest cut, a finish that holds up from morning to midnight — across denim,
            shirts, shoes and the essentials that go with them, for men, women and kids.
          </p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            Every piece is designed in-house and made in small, limited runs. When one sells out,
            it is genuinely gone — we would rather cut a new pattern than repeat a mediocre one.
          </p>
          <Link href="/pages/about" className="btn btn-outline mt-9">
            Read our story
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
