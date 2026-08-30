'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_SLIDES } from '@/lib/data/hero';

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = HERO_SLIDES.length;

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count]);

  return (
    <section
      className="relative h-[500px] w-full overflow-hidden bg-[var(--color-gray-50)] md:h-[560px] lg:h-[640px]"
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
    >
      {HERO_SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={i !== index}
        >
          <Image
            src={slide.image}
            alt={slide.headline}
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover object-[70%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
          <div className="container-page relative flex h-full items-center">
            <div className="max-w-[34rem] text-white sm:pl-8 lg:pl-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/85">
                {slide.eyebrow}
              </p>
              <h1 className="mt-3 text-[2.15rem] font-black uppercase leading-[1.03] tracking-[-0.01em] sm:text-5xl lg:text-[3.4rem]">
                {slide.headline}
              </h1>
              <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-white/85 sm:text-base">
                {slide.subheadline}
              </p>
              <Link
                href={slide.href}
                className="btn btn-red mt-7 rounded-[12px] px-8 py-3.5 text-[13px] uppercase tracking-[0.14em]"
              >
                {slide.cta}
              </Link>
            </div>
          </div>
        </div>
      ))}

      {/* arrows */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(index - 1)}
        className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[var(--color-ink)] transition hover:bg-white sm:left-5 sm:h-11 sm:w-11"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(index + 1)}
        className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[var(--color-ink)] transition hover:bg-white sm:right-5 sm:h-11 sm:w-11"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* dots */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-7 bg-white' : 'w-1.5 bg-white/50'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
