'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, money } from '@/lib/client';
import { DataTable, PageHeader } from '@/components/shell';

interface Row {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  mrp: string;
  salePrice: string;
  soldCount: number;
  brand: { name: string } | null;
  _count: { variants: number };
}

export default function ProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    apiFetch<{ items: Row[]; total: number }>(`/admin/products?${params}`)
      .then((d) => {
        setRows(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError((e as Error).message));
  }, [page, q, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(row: Row) {
    const next = row.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    await apiFetch(`/admin/products/${row.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  return (
    <>
      <PageHeader title="Products" subtitle={`${total} products`} />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder="Search name or SKU"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-bad)]">{error}</p>}

      <DataTable<Row>
        rows={rows}
        columns={[
          {
            key: 'name',
            header: 'Product',
            render: (r) => (
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {r.brand?.name ?? '—'} · {r._count.variants} variants · {r.sku ?? 'no SKU'}
                </p>
              </div>
            ),
          },
          {
            key: 'price',
            header: 'Price',
            render: (r) => (
              <span>
                {money(r.salePrice)}{' '}
                {Number(r.mrp) > Number(r.salePrice) && (
                  <span className="text-xs text-[var(--color-muted)] line-through">
                    {money(r.mrp)}
                  </span>
                )}
              </span>
            ),
          },
          { key: 'sold', header: 'Sold', render: (r) => r.soldCount },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <button
                onClick={() => toggleStatus(r)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  r.status === 'ACTIVE'
                    ? 'bg-green-100 text-[var(--color-good)]'
                    : 'bg-gray-100 text-[var(--color-muted)]'
                }`}
              >
                {r.status}
              </button>
            ),
          },
        ]}
      />

      <div className="mt-4 flex gap-2 text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-md border border-[var(--color-line)] px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-2 py-1.5 text-[var(--color-muted)]">Page {page}</span>
        <button
          disabled={page * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-[var(--color-line)] px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </>
  );
}
