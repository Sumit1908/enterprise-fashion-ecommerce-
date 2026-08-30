import Link from 'next/link';
import { Reveal } from './reveal';

/**
 * Consistent section title block: small gold eyebrow, serif display title,
 * optional supporting line and a right-aligned text CTA on larger screens.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  align?: 'left' | 'center';
}) {
  const centered = align === 'center';
  return (
    <Reveal
      className={`mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end ${
        centered ? 'text-center' : 'sm:justify-between'
      }`}
    >
      <div className={centered ? 'mx-auto max-w-2xl' : 'max-w-xl'}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-3 font-display text-[1.75rem] leading-tight sm:text-4xl">{title}</h2>
        {description && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">{description}</p>
        )}
      </div>
      {ctaLabel && ctaHref && !centered && (
        <Link
          href={ctaHref}
          className="link-underline shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink)]"
        >
          {ctaLabel}
        </Link>
      )}
    </Reveal>
  );
}
