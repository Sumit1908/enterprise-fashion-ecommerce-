'use client';

import { useEffect, useState } from 'react';
import { apiFetch, money } from '@/lib/client';
import { PageHeader } from '@/components/shell';

interface Overview {
  kpis: {
    revenue30d: string;
    orders30d: number;
    totalProducts: number;
    activeProducts: number;
    totalCustomers: number;
    lowStockVariants: number;
    pendingReviews: number;
    openReturns: number;
  };
  dailyMetrics: { date: string; revenue: string; orders: number }[];
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Overview>('/admin/overview').then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;

  const cards = [
    ['Revenue (30d)', money(data.kpis.revenue30d)],
    ['Orders (30d)', data.kpis.orders30d],
    ['Active products', `${data.kpis.activeProducts} / ${data.kpis.totalProducts}`],
    ['Customers', data.kpis.totalCustomers],
    ['Low-stock variants', data.kpis.lowStockVariants],
    ['Pending reviews', data.kpis.pendingReviews],
    ['Open returns', data.kpis.openReturns],
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Store performance over the last 30 days." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
          >
            <p className="text-xs uppercase text-[var(--color-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold">Daily revenue</h2>
      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        {data.dailyMetrics.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No metrics yet. The nightly aggregation job populates this once orders start coming in.
          </p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {data.dailyMetrics.map((d) => {
              const max = Math.max(...data.dailyMetrics.map((m) => Number(m.revenue)), 1);
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${money(d.revenue)}`}
                  className="flex-1 rounded-t bg-[var(--color-brand)]"
                  style={{ height: `${(Number(d.revenue) / max) * 100}%` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
