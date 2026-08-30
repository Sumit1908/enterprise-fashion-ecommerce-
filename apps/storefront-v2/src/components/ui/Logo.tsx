import Link from 'next/link';

/**
 * SLAY JEANS wordmark. A "SLAY / JEANS" lockup with a red brand mark —
 * original, no reference logo used.
 */
export function Logo({
  className = '',
  compact = false,
  light = false,
  asLink = true,
}: {
  className?: string;
  compact?: boolean;
  light?: boolean;
  asLink?: boolean;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className={`grid h-8 w-8 place-items-center rounded-[7px] shadow-sm transition-transform group-hover:-rotate-6 ${
          light ? 'bg-white text-[var(--color-red)]' : 'bg-[var(--color-red)] text-white'
        }`}
      >
        <span className="text-[15px] font-black leading-none">S</span>
      </span>
      {!compact ? (
        <span className="leading-[0.86]">
          <span
            className={`block text-[15px] font-black tracking-[0.34em] ${
              light ? 'text-white' : 'text-[var(--color-ink)]'
            }`}
          >
            SLAY
          </span>
          <span
            className={`block text-[11px] font-bold tracking-[0.42em] ${
              light ? 'text-white/80' : 'text-[var(--color-text-muted)]'
            }`}
          >
            JEANS
          </span>
        </span>
      ) : (
        <span
          className={`text-[15px] font-black tracking-[0.28em] ${
            light ? 'text-white' : 'text-[var(--color-ink)]'
          }`}
        >
          SLAY&nbsp;JEANS
        </span>
      )}
    </>
  );

  if (!asLink) {
    return <span className={`group inline-flex items-center gap-2.5 ${className}`}>{inner}</span>;
  }

  return (
    <Link
      href="/"
      aria-label="SLAY JEANS — home"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      {inner}
    </Link>
  );
}
