'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PRODUCTS, formatINR } from '@/lib/data/products';
import { TRENDING_SEARCHES } from '@/lib/data/popularSearches';

const RECENT_KEY = 'sj2_recent_search';

export function SearchOverlay() {
  const { overlay, closeOverlay } = useStore();
  const open = overlay === 'search';
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 60);
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'));
    } catch {
      setRecent([]);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeOverlay();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOverlay]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term),
    ).slice(0, 6);
  }, [q]);

  function commit(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    closeOverlay();
    window.location.href = `/shop?q=${encodeURIComponent(t)}`;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/50" onClick={closeOverlay} />
      <div className="animate-fade-up absolute inset-x-0 top-0 max-h-[86vh] overflow-y-auto bg-white">
        <div className="container-page py-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit(q);
            }}
            className="flex items-center gap-3"
          >
            <div className="flex flex-1 items-center gap-3 rounded-full border border-[var(--color-red)] pl-4 pr-1.5">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search For Products"
                aria-label="Search for products"
                className="h-11 flex-1 bg-transparent text-[14px] outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-red)] text-white"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={closeOverlay}
              aria-label="Close search"
              className="grid h-10 w-10 place-items-center"
            >
              <X className="h-5 w-5" />
            </button>
          </form>

          {results.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  onClick={closeOverlay}
                  className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-2 hover:border-[var(--color-ink)]"
                >
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-[var(--color-gray-50)]">
                    <Image src={p.images[0]} alt="" fill sizes="48px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{p.name}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">{formatINR(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-7 grid gap-7 sm:grid-cols-2">
              {recent.length > 0 && (
                <div>
                  <p className="eyebrow mb-3">Recent Searches</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => commit(r)}
                        className="pill pill--soft text-[12px]"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="eyebrow mb-3">Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_SEARCHES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => commit(r)}
                      className="pill pill--soft text-[12px]"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
