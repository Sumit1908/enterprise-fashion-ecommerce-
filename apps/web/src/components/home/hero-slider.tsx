'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getImageProps } from 'next/image';
import type { HomeResponse } from '@/lib/api';

type Slide = HomeResponse['banners'][number];

const AUTOPLAY_MS = 6000;

const MOBILE_MEDIA = '(max-width: 767.98px)';
const DESKTOP_MEDIA = '(min-width: 768px)';

/**
 * Runs a hero image through Next's built-in optimizer (AVIF/WebP + a real
 * responsive srcset) while keeping the manual <picture> art-direction the
 * design needs — `next/image`'s <Image> component doesn't support multiple
 * <source> breakpoints directly, so we use the same optimizer via
 * `getImageProps` and assemble the <picture> ourselves. Full-bleed hero, so
 * `sizes="100vw"` at every breakpoint (each source only loads at its own
 * media query, so mobile never pays for the desktop-sized variant).
 */
function heroImageProps(src: string, alt: string, isPriority: boolean) {
  const { props } = getImageProps({
    src,
    alt,
    fill: true,
    sizes: '100vw',
    quality: 85,
    priority: isPriority,
  });
  return props;
}

export function HeroSlider({ slides }: { slides: Slide[] }) {
  const usable = slides.filter((s) => s.imageUrl);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  const count = usable.length;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  // Autoplay — pauses on hover/focus, when the tab is hidden, or when the
  // viewer prefers reduced motion.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setIndex((prev) => (prev + 1) % count);
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused, index]);

  if (count === 0) return null;

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative flex min-h-[86vh] items-end overflow-hidden sm:min-h-[92vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {usable.map((slide, i) => {
        const active = i === index;
        const isPriority = i === 0; // only the first (LCP-candidate) slide is eager/high-priority
        const alt = slide.headline ?? slide.title ?? '';
        const desktop = heroImageProps(slide.imageUrl!, alt, isPriority);
        const mobile = slide.imageMobileUrl
          ? heroImageProps(slide.imageMobileUrl, alt, isPriority)
          : null;

        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${
              active ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {/* Preload hints for the LCP slide — matches the <picture> media
                queries below so whichever breakpoint is active is fetched
                immediately. getImageProps() (unlike <Image priority>) doesn't
                inject these on its own for art-directed/multi-source images. */}
            {isPriority && mobile && (
              <link
                rel="preload"
                as="image"
                href={mobile.src}
                imageSrcSet={mobile.srcSet}
                imageSizes={mobile.sizes}
                media={MOBILE_MEDIA}
                fetchPriority="high"
              />
            )}
            {isPriority && (
              <link
                rel="preload"
                as="image"
                href={desktop.src}
                imageSrcSet={desktop.srcSet}
                imageSizes={desktop.sizes}
                media={mobile ? DESKTOP_MEDIA : undefined}
                fetchPriority="high"
              />
            )}

            <picture>
              {mobile && <source media={MOBILE_MEDIA} srcSet={mobile.srcSet} sizes={mobile.sizes} />}
              {/* eslint-disable-next-line @next/next/no-img-element -- art-directed
                  <picture> with a manual mobile/desktop source; Next's <Image>
                  can't express multiple breakpoints, so getImageProps() feeds
                  its optimized attrs (AVIF/WebP + responsive srcset) into a
                  plain <img> here instead. */}
              <img
                {...desktop}
                alt={alt}
                // getImageProps()'s `style` (fill mode) only sets positioning —
                // object-fit/object-position still need to come from us, exactly
                // matching the original markup's crop/anchor.
                className="object-cover object-center"
                loading={isPriority ? 'eager' : 'lazy'}
                fetchPriority={isPriority ? 'high' : 'low'}
                draggable={false}
              />
            </picture>

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
            <div className="absolute inset-0 hidden bg-gradient-to-r from-black/55 to-transparent sm:block" />

            <div className="container-wide relative z-10 flex min-h-[86vh] items-end pb-16 pt-28 text-[var(--color-bone)] sm:min-h-[92vh] sm:pb-24">
              <div>
                {slide.title && (
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-soft)]">
                    {slide.title}
                  </p>
                )}
                {slide.headline && (
                  <h1 className="mt-5 max-w-[52rem] text-balance font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem]">
                    {slide.headline}
                  </h1>
                )}
                {slide.subheadline && (
                  <p className="mt-5 max-w-md text-base text-[var(--color-bone)]/85 sm:text-lg">
                    {slide.subheadline}
                  </p>
                )}
                <div className="mt-9 flex flex-wrap items-center gap-6">
                  {slide.ctaUrl && (
                    <Link
                      href={slide.ctaUrl}
                      className="btn btn-light"
                      tabIndex={active ? 0 : -1}
                    >
                      {slide.ctaLabel ?? 'Shop now'}
                    </Link>
                  )}
                  <Link
                    href="/shop"
                    tabIndex={active ? 0 : -1}
                    className="link-underline text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-bone)]"
                  >
                    Explore all new in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 sm:bottom-8">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-bone)]/40 bg-black/20 text-[var(--color-bone)] backdrop-blur-sm transition hover:bg-black/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            {usable.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? 'w-7 bg-[var(--color-bone)]'
                    : 'w-1.5 bg-[var(--color-bone)]/50 hover:bg-[var(--color-bone)]/80'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-bone)]/40 bg-black/20 text-[var(--color-bone)] backdrop-blur-sm transition hover:bg-black/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
