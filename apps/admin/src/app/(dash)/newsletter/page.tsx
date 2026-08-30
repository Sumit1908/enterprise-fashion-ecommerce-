'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Input } from '@/components/form';

interface Subscriber {
  id: string;
  email: string;
  status: string;
  source: string | null;
  firstName: string | null;
  createdAt: string;
}
interface ListResponse {
  items: Subscriber[];
  total: number;
  subscribed: number;
  page: number;
  pageSize: number;
}

export default function NewsletterPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState('subscribed');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ status, page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    apiFetch<ListResponse>(`/admin/newsletter?${params}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [status, q, page]);

  useEffect(load, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Newsletter" subtitle="Subscribers captured from the storefront footer and pop-ups." />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-[var(--color-muted)]">Active subscribers</p>
          <p className="mt-1 text-2xl font-semibold">{data?.subscribed ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-[var(--color-muted)]">Shown</p>
          <p className="mt-1 text-2xl font-semibold">{data?.total ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-[var(--color-muted)]">Export</p>
          <Button
            variant="ghost"
            className="mt-1"
            onClick={() => apiDownload('/admin/newsletter/export.csv', 'slay-newsletter.csv')}
          >
            Download CSV
          </Button>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {['subscribed', 'unsubscribed', 'all'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                status === s
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'border-[var(--color-line)] text-[var(--color-muted)]'
              }`}
            >
              {s}
            </button>
          ))}
          <Input
            placeholder="Search email"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        </div>

        {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-[var(--color-muted)]">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((s) => (
                <tr key={s.id} className="border-t border-[var(--color-line)]">
                  <td className="py-2 pr-3">{s.email}</td>
                  <td className="py-2 pr-3 capitalize">{s.status}</td>
                  <td className="py-2 pr-3">{s.source ?? '—'}</td>
                  <td className="py-2 pr-3">{s.firstName ?? '—'}</td>
                  <td className="py-2">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-muted)]">
                    No subscribers here yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="mt-4 flex gap-2 text-sm">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="px-2 py-2 text-[var(--color-muted)]">
              Page {page} of {pages}
            </span>
            <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
