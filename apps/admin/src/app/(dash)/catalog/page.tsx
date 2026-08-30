'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Field, Input, Textarea } from '@/components/form';
import { MediaUploader } from '@/components/media-uploader';

type Tab = 'categories' | 'brands' | 'collections';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  showInMenu: boolean;
  sortOrder: number;
  imageUrl: string | null;
  bannerUrl: string | null;
  _count: { products: number; children: number };
}
interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isFeatured: boolean;
  _count: { products: number };
}
interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  imageUrl: string | null;
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

/* ------------------------------------------------------------ categories */

function Categories() {
  const { rows, error, reload } = useList<CategoryRow>('/admin/categories');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

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
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm"
          >
            <option value="">Top level</option>
            {tops.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
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
              <CategoryRowView
                row={t}
                open={editing === t.id}
                onToggleOpen={() => setEditing(editing === t.id ? null : t.id)}
                onPatch={patch}
                onDelete={del}
                onSaved={reload}
              />
              <div className="ml-6 border-l border-[var(--color-line)] pl-3">
                {childrenOf(t.id).map((c) => (
                  <CategoryRowView
                    key={c.id}
                    row={c}
                    open={editing === c.id}
                    onToggleOpen={() => setEditing(editing === c.id ? null : c.id)}
                    onPatch={patch}
                    onDelete={del}
                    onSaved={reload}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CategoryRowView({
  row,
  open,
  onToggleOpen,
  onPatch,
  onDelete,
  onSaved,
}: {
  row: CategoryRow;
  open: boolean;
  onToggleOpen: () => void;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onSaved: () => void;
}) {
  return (
    <div className="border-t border-[var(--color-line)] py-1.5 first:border-t-0">
      <div className="flex items-center justify-between">
        <button onClick={onToggleOpen} className="flex items-center gap-2 text-left">
          {row.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-canvas)] text-[10px] text-[var(--color-muted)]">
              img
            </span>
          )}
          <span>
            {row.name}
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              /{row.slug} · {row._count.products} products
            </span>
          </span>
        </button>
        <span className="flex items-center gap-3 text-xs">
          <button
            onClick={() => onPatch(row.id, { isActive: !row.isActive })}
            className={row.isActive ? 'text-[var(--color-good)]' : 'text-[var(--color-muted)]'}
          >
            {row.isActive ? 'Active' : 'Hidden'}
          </button>
          <button
            onClick={() => onPatch(row.id, { showInMenu: !row.showInMenu })}
            className={row.showInMenu ? 'text-[var(--color-brand)]' : 'text-[var(--color-muted)]'}
          >
            {row.showInMenu ? 'In menu' : 'Off menu'}
          </button>
          <button onClick={onToggleOpen} className="text-[var(--color-brand)]">
            {open ? 'Close' : 'Edit'}
          </button>
          <button onClick={() => onDelete(row.id)} className="text-[var(--color-bad)]">Delete</button>
        </span>
      </div>
      {open && <CategoryEditor row={row} onSaved={onSaved} />}
    </div>
  );
}

function CategoryEditor({ row, onSaved }: { row: CategoryRow; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? '');
  const [imageUrl, setImageUrl] = useState(row.imageUrl ?? '');
  const [bannerUrl, setBannerUrl] = useState(row.bannerUrl ?? '');
  const [sortOrder, setSortOrder] = useState(String(row.sortOrder));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch(`/admin/categories/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          description,
          imageUrl,
          bannerUrl,
          sortOrder: Number(sortOrder) || 0,
        }),
      });
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-4 rounded-md bg-[var(--color-canvas)] p-4 sm:grid-cols-2">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Sort order">
        <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description" hint="Shown under the category title on the storefront">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div>
        <Field label="Tile image URL" hint="Square-ish; used in 'Shop by Category'">
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <div className="mt-2 flex items-center gap-3">
          <MediaUploader onUploaded={setImageUrl} />
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-14 w-14 rounded border border-[var(--color-line)] object-cover" />
          )}
        </div>
      </div>
      <div>
        <Field label="Banner image URL" hint="Wide; used at the top of the category page">
          <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <div className="mt-2 flex items-center gap-3">
          <MediaUploader onUploaded={setBannerUrl} />
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="h-14 w-24 rounded border border-[var(--color-line)] object-cover" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save category'}</Button>
        {msg && <span className="text-xs text-[var(--color-muted)]">{msg}</span>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- brands */

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
          <Input placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
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

/* ------------------------------------------------------------ collections */

function Collections() {
  const { rows, error, reload } = useList<CollectionRow>('/admin/collections');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

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
          <Input placeholder="Collection name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Button onClick={add}>Add</Button>
        </div>
      </Card>
      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}
      <Card>
        <div className="space-y-1 text-sm">
          {rows.map((c) => (
            <div key={c.id} className="border-t border-[var(--color-line)] py-1.5 first:border-t-0">
              <div className="flex items-center justify-between">
                <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="flex items-center gap-2 text-left">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-canvas)] text-[10px] text-[var(--color-muted)]">img</span>
                  )}
                  <span>
                    {c.name}
                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                      /{c.slug} · {c.type} · {c._count.products} products
                    </span>
                  </span>
                </button>
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
                  <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="text-[var(--color-brand)]">
                    {editing === c.id ? 'Close' : 'Edit'}
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
              {editing === c.id && <CollectionEditor row={c} onSaved={reload} />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CollectionEditor({ row, onSaved }: { row: CollectionRow; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? '');
  const [imageUrl, setImageUrl] = useState(row.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch(`/admin/collections/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description, imageUrl }),
      });
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-4 rounded-md bg-[var(--color-canvas)] p-4 sm:grid-cols-2">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div>
        <Field label="Image URL">
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <div className="mt-2 flex items-center gap-3">
          <MediaUploader onUploaded={setImageUrl} />
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-14 w-14 rounded border border-[var(--color-line)] object-cover" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save collection'}</Button>
        {msg && <span className="text-xs text-[var(--color-muted)]">{msg}</span>}
      </div>
    </div>
  );
}
