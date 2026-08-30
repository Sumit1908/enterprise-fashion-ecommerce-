'use client';

import Link from 'next/link';
import { Gift } from 'lucide-react';

export function ReferEarnButton() {
  return (
    <Link
      href="/refer"
      className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 items-center rounded-r-lg bg-[var(--color-red)] px-2 py-4 text-white shadow-md transition hover:bg-[var(--color-red-dark)] sm:flex"
      style={{ writingMode: 'vertical-rl' }}
      aria-label="Refer & Earn"
    >
      <span className="rotate-180 text-[12px] font-bold uppercase tracking-[0.16em]">
        Refer &amp; Earn
      </span>
    </Link>
  );
}

export function RewardsButton() {
  return (
    <Link
      href="/rewards"
      className="fixed bottom-4 left-4 z-30 inline-flex items-center gap-2 rounded-full bg-[var(--color-red)] px-4 py-2.5 text-white shadow-lg transition hover:scale-105 hover:bg-[var(--color-red-dark)]"
      aria-label="Rewards"
    >
      <Gift className="h-4 w-4" />
      <span className="text-[13px] font-bold uppercase tracking-[0.08em]">Rewards</span>
    </Link>
  );
}
