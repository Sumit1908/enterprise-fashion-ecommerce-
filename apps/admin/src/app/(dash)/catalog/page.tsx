'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Input } from '@/components/form';

type Tab = 'categories' | 'brands' | 'collections';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  showInMenu: boolean;
  sortOrder: number;
  _count: { products: number; children: number };
}
interface BrandRow {
  id: string;
  name: string;
  slug: string;
  isFeatured: boolean;
  _count: { products: number };
}
interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  isFeatured: boolean;
  _count: { products: number };
}

export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>('categories');
  return (
    <>
      <PageHeader title="Categories & Collections" subtitle="Structure the catalog. Changes are live." />
      <div className="mb-5 flex gap-1 border-b border-[var(--color-line)]">
        {(['categories', 'brands', 'collections'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize ${
              tab === t
                ? 'border-[var(--color-brand)] font-medium text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-muted)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'categories' && <Categories />}
      {tab === 'brands' && <Brands />}
      {tab === 'collections' && <Collections />}
    </>
  );
}

function useList<T>(path: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    apiFetch<T[]>(path)
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, [path]);
  useEffect(reload, [reload]);
  return { rows, error, reload };
}

function Categories() {
  const { rows, error, reload } = useList<CategoryRow>('/admin/categories');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  async function add() {
    if (!name.trim()) return;
    await apiFetch('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, parentId: parentId || undefined }),
    });
    setName('');
    setParentId('');
    reload();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await apiFetch(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    reload();
  }
  async function del(id: string) {
    if (!confirm('Delete this category?')) return;
    try {
      await apiFetch(`/admin/categories/${id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const tops = rows.filter((r) => !r.parentId);
  const childrenOf = (id: string) => rows.filter((r) => r.parentId === id);

  return (
    <div className="space-y-5">
      <Card title="Add category">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
          >
            <option value="">Top level</option>
            {tops.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button onClick={add}>Add</Button>
        </div>
      </Card>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      <Card>
        <div className="space-y-1 text-sm">
          {tops.map((t) => (
            <div key={t.id}>
              <Row row={t} onToggle={patch} onDelete={del} />
              <div className="ml-6 border-l border-[var(--color-line)] pl-3">
                {childrenOf(t.id).map((c) => (
                  <Row key={c.id} row={c} onToggle={patch} onDelete={del} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({
  row,
  onToggle,
  onDelete,
}: {
  row: CategoryRow;
  onToggle: (id: string, body: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span>
        {row.name}
        <span className="ml-2 text-xs text-[var(--color-muted)]">
          /{row.slug} · {row._count.products} products
        </span>
      </span>
      <span className="flex items-center gap-3 text-xs">
        <button
          onClick={() => onToggle(row.id, { isActive: !row.isActive })}
          className={row.isActive ? 'text-[var(--color-good)]' : 'text-[var(--color-muted)]'}
        >
          {row.isActive ? 'Active' : 'Hidden'}
        </button>
        <button
          onClick={() => onToggle(row.id, { showInMenu: !row.showInMenu })}
          className={row.showInMenu ? 'text-[var(--color-brand)]' : 'text-[var(--color-muted)]'}
        >
          {row.showInMenu ? 'In menu' : 'Off menu'}
        </button>
        <button onClick={() => onDelete(row.id)} className="text-[var(--color-bad)]">
          Delete
        </button>
      </span>
    </div>
  );
}

function Brands() {
  const { rows, error, reload } = useList<BrandRow>('/admin/brands');
  const [name, setName] = useState('');

  async function add() {
    if (!name.trim()) return;
    await apiFetch('/admin/brands', { method: 'POST', body: JSON.stringify({ name }) });
    setName('');
    reload();
  }

  return (
    <div className="space-y-5">
      <Card title="Add brand">
        <div className="flex gap-2">
          <Input
            placeholder="Brand name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}
      <Card>
        <div className="space-y-1 text-sm">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-1.5">
              <span>
                {b.name}
                <span className="ml-2 text-xs text-[var(--color-muted)]">
                  /{b.slug} · {b._count.products} products
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <button
                  onClick={async () => {
                    await apiFetch(`/admin/brands/${b.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ isFeatured: !b.isFeatured }),
                    });
                    reload();
                  }}
                  className={b.isFeatured ? 'text-[var(--color-brand)]' : 'text-[var(--color-muted)]'}
                >
                  {b.isFeatured ? 'Featured' : 'Not featured'}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete brand?')) return;
                    try {
                      await apiFetch(`/admin/brands/${b.id}`, { method: 'DELETE' });
                      reload();
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  }}
                  className="text-[var(--color-bad)]"
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Collections() {
  const { rows, error, reload } = useList<CollectionRow>('/admin/collections');
  const [name, setName] = useState('');

  async function add() {
    if (!name.trim()) return;
    await apiFetch('/admin/collections', { method: 'POST', body: JSON.stringify({ name }) });
    setName('');
    reload();
  }

  return (
    <div className="space-y-5">
      <Card title="Add collection">
        <div className="flex gap-2">
          <Input
            placeholder="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}
      <Card>
        <div className="space-y-1 text-sm">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <span>
                {c.name}
                <span className="ml-2 text-xs text-[var(--color-muted)]">
                  /{c.slug} · {c.type} · {c._count.products} products
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs">
                <button
                  onClick={async () => {
                    await apiFetch(`/admin/collections/${c.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ isFeatured: !c.isFeatured }),
                    });
                    reload();
                  }}
                  className={c.isFeatured ? 'text-[var(--color-brand)]' : 'text-[var(--color-muted)]'}
                >
                  {c.isFeatured ? 'Featured' : 'Not featured'}
                </button>
                <button
                  onClick={async () => {
                    await apiFetch(`/admin/collections/${c.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ isActive: !c.isActive }),
                    });
                    reload();
                  }}
                  className={c.isActive ? 'text-[var(--color-good)]' : 'text-[var(--color-muted)]'}
                >
                  {c.isActive ? 'Active' : 'Hidden'}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Delete collection?')) return;
                    await apiFetch(`/admin/collections/${c.id}`, { method: 'DELETE' });
                    reload();
                  }}
                  className="text-[var(--color-bad)]"
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
