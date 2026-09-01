import Link from 'next/link';
import { Reveal } from '@/components/ui/reveal';

export function BrandStory() {
  return (
    <section className="bg-[var(--color-paper)]">
      <div className="container-wide py-20 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Our Philosophy</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-5xl">
            Wear less. Choose better.
          </h2>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            At Velor House, we believe great style doesn&rsquo;t need to shout. It lives in the
            fabric you can feel, the fit you notice, and the details that stay right long after the
            first wear.
          </p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            From everyday denim to refined shirts, footwear and timeless essentials, every piece is
            thoughtfully designed for modern life — for men, women and kids.
          </p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            We focus on better materials, cleaner design and lasting quality, creating collections
            you&rsquo;ll reach for again and again. No unnecessary trends. No overproduction. Just
            clothing worth keeping.
          </p>
          <Link href="/pages/about" className="btn btn-outline mt-9">
            Read our story
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
