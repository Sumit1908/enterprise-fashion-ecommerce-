'use client';

import { Check } from 'lucide-react';
import { useStore } from '@/lib/store';

export function Toast() {
  const { toast } = useStore();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      {toast && (
        <div className="animate-fade-up pointer-events-auto flex items-center gap-2.5 rounded-full bg-[var(--color-ink)] px-5 py-3 text-[13px] font-semibold text-white shadow-xl">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-red)]">
            <Check className="h-3 w-3" />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
