import Link from 'next/link';
import { CATEGORY_PILLS } from '@/lib/data/nav';

export function CategoryPills() {
  return (
    <div className="border-b border-[var(--color-border)] bg-white">
      <div className="container-page">
        <div className="hide-scrollbar edge-fade-r -mx-1 flex items-center gap-2.5 overflow-x-auto py-3 md:justify-center md:overflow-visible">
          {CATEGORY_PILLS.map((p) => (
            <div key={p.href} className="relative shrink-0">
              {p.badge && (
                <span className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                  {p.badge}
                </span>
              )}
              <Link
                href={p.href}
                className={`pill ${p.sale ? 'pill--sale' : 'pill--soft'} text-[12px]`}
              >
                {p.label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
