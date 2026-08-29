'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { DataTable, PageHeader } from '@/components/shell';

interface Row {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
  _count: { orders: number };
}

export default function CustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    apiFetch<{ items: Row[]; total: number }>(`/admin/customers?${params}`)
      .then((d) => {
        setRows(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError((e as Error).message));
  }, [q]);

  return (
    <>
      <PageHeader title="Customers" subtitle={`${total} customers`} />
      <input
        placeholder="Search email, phone or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
      />
      {error && <p className="mb-3 text-sm text-[var(--color-bad)]">{error}</p>}
      <DataTable<Row>
        rows={rows}
        empty="No customers yet."
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (r) => [r.firstName, r.lastName].filter(Boolean).join(' ') || '—',
          },
          { key: 'email', header: 'Email', render: (r) => r.email ?? '—' },
          { key: 'phone', header: 'Phone', render: (r) => r.phone ?? '—' },
          { key: 'orders', header: 'Orders', render: (r) => r._count.orders },
          { key: 'status', header: 'Status', render: (r) => r.status },
          {
            key: 'joined',
            header: 'Joined',
            render: (r) => new Date(r.createdAt).toLocaleDateString('en-IN'),
          },
        ]}
      />
    </>
  );
}
