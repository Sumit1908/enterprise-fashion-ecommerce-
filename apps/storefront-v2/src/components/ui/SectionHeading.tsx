import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function SectionHeading({
  title,
  eyebrow,
  ctaLabel,
  ctaHref,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}) {
  return (
    <div className={`mb-6 flex items-end justify-between gap-4 lg:mb-9 ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="h-section">{title}</h2>
      </div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="group inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-ink)] hover:text-[var(--color-red)]"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
