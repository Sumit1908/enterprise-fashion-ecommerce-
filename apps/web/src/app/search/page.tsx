'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import type { ProductCard as Card } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SearchResult {
  term: string;
  suggestions: string[];
  products: Card[];
}

export default function SearchPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">
          Loading search…
        </div>
      }
    >
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const router = useRouter();
  const initialQ = useSearchParams().get('q') ?? '';
  const [q, setQ] = useState(initialQ);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/storefront/search?q=${encodeURIComponent(term.trim())}`,
        { headers: { accept: 'application/json' } },
      );
      setResult(res.ok ? ((await res.json()) as SearchResult) : null);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ) void run(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(value: string) {
    setQ(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void run(value);
      const params = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : '';
      router.replace(`/search${params}`, { scroll: false });
    }, 300);
  }

  return (
    <div className="container-wide py-10">
      <h1 className="font-display text-3xl font-semibold">Search</h1>

      <div className="mt-6 max-w-xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for jeans, washes, fits…"
          className="w-full rounded-full border border-[var(--color-sand)] px-5 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
        />
      </div>

      {loading && (
        <p className="mt-6 text-sm text-[var(--color-ink-soft)]">Searching…</p>
      )}

      {!loading && result && (
        <>
          <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
            {result.products.length} result{result.products.length === 1 ? '' : 's'} for &ldquo;{result.term}&rdquo;
          </p>
          {result.products.length === 0 ? (
            <p className="py-16 text-center text-[var(--color-ink-soft)]">
              No matches. Try a different term.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {result.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !result && q.trim().length < 2 && (
        <p className="mt-8 text-sm text-[var(--color-ink-soft)]">
          Type at least 2 characters to search.
        </p>
      )}
    </div>
  );
}
