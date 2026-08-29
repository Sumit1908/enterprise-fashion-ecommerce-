'use client';

import { useEffect, useState } from 'react';
import { apiFetch, money } from '@/lib/client';
import { DataTable, PageHeader } from '@/components/shell';

interface Row {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: string;
  currency: string;
  placedAt: string;
  user: { email: string | null; firstName: string | null } | null;
  _count: { items: number };
}

export default function OrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    apiFetch<{ items: Row[]; total: number }>(`/admin/orders?${params}`)
      .then((d) => {
        setRows(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError((e as Error).message));
  }, [status]);

  return (
    <>
      <PageHeader title="Orders" subtitle={`${total} orders`} />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="mb-4 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        {['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'].map(
          (s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ),
        )}
      </select>

      {error && <p className="mb-3 text-sm text-[var(--color-bad)]">{error}</p>}

      <DataTable<Row>
        rows={rows}
        empty="No orders yet."
        columns={[
          { key: 'no', header: 'Order', render: (r) => <span className="font-medium">{r.orderNumber}</span> },
          {
            key: 'customer',
            header: 'Customer',
            render: (r) => r.user?.email ?? r.user?.firstName ?? 'Guest',
          },
          { key: 'items', header: 'Items', render: (r) => r._count.items },
          { key: 'total', header: 'Total', render: (r) => money(r.grandTotal, r.currency) },
          { key: 'payment', header: 'Payment', render: (r) => r.paymentStatus },
          { key: 'status', header: 'Status', render: (r) => r.status },
          {
            key: 'date',
            header: 'Placed',
            render: (r) => new Date(r.placedAt).toLocaleDateString('en-IN'),
          },
        ]}
      />
    </>
  );
}
