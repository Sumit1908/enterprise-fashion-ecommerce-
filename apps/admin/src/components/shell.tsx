'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getToken } from '@/lib/client';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/products', label: 'Products' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/orders', label: 'Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/catalog', label: 'Categories & Collections' },
  { href: '/newsletter', label: 'Newsletter' },
  { href: '/marketing', label: 'Coupons & Promotions' },
  { href: '/content', label: 'Banners & Pages' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return <div className="p-10 text-sm text-[var(--color-muted)]">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--color-line)] bg-[var(--color-surface)] p-4 md:block">
        <div className="px-2 py-3 text-sm font-semibold">
          Slay<span className="text-[var(--color-brand)]">Jeans</span> Admin
        </div>
        <nav className="mt-4 space-y-1">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-ink)] hover:bg-[var(--color-canvas)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => {
            clearToken();
            router.push('/login');
          }}
          className="mt-6 w-full rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-muted)]"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
    </header>
  );
}

export function DataTable<T>({
  columns,
  rows,
  empty = 'Nothing here yet.',
}: {
  columns: { key: string; header: string; render: (row: T) => React.ReactNode }[];
  rows: T[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-muted)]">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-line)] text-left text-xs uppercase text-[var(--color-muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--color-line)] last:border-0">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-3">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
