'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from '@/components/form';
import { MediaUploader } from '@/components/media-uploader';

const FLAGS: { key: string; label: string }[] = [
  { key: 'isFeatured', label: 'Featured' },
  { key: 'isBestSeller', label: 'Best seller' },
  { key: 'isNewArrival', label: 'New arrival' },
  { key: 'isTrending', label: 'Trending' },
  { key: 'isHot', label: 'Hot' },
  { key: 'isStaffPick', label: 'Staff pick' },
  { key: 'isExclusive', label: 'Exclusive' },
];

interface Ref {
  id: string;
  name: string;
}
interface VariantRow {
  sku: string;
  value: string;
  stock: number;
}

export interface ProductFormValue {
  id?: string;
  name: string;
  slug: string;
  status: string;
  brandId: string;
  gender: string;
  mrp: string;
  salePrice: string;
  shortDescription: string;
  description: string;
  fabricDetails: string;
  careInstructions: string;
  flags: Record<string, boolean>;
  categoryIds: string[];
  mediaText: string;
  optionName: string;
  variants: VariantRow[];
}

const EMPTY: ProductFormValue = {
  name: '',
  slug: '',
  status: 'DRAFT',
  brandId: '',
  gender: '',
  mrp: '',
  salePrice: '',
  shortDescription: '',
  description: '',
  fabricDetails: '',
  careInstructions: '',
  flags: {},
  categoryIds: [],
  mediaText: '',
  optionName: 'Size',
  variants: [],
};

export function ProductForm({ initial }: { initial?: Partial<ProductFormValue> }) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValue>({ ...EMPTY, ...initial });
  const [brands, setBrands] = useState<Ref[]>([]);
  const [categories, setCategories] = useState<(Ref & { parentId: string | null })[]>([]);
  const [sizes, setSizes] = useState(
    initial?.variants?.map((x) => x.value).join(', ') ?? '28, 30, 32, 34, 36',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(v.id);

  useEffect(() => {
    apiFetch<Ref[]>('/admin/brands').then(setBrands).catch(() => undefined);
    apiFetch<(Ref & { parentId: string | null })[]>('/admin/categories')
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const variants = useMemo<VariantRow[]>(() => {
    const list = sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const skuBase = (v.slug || v.name || 'sku')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .slice(0, 12);
    return list.map((value) => {
      const prev = v.variants.find((x) => x.value === value);
      return { value, sku: prev?.sku || `${skuBase}-${value}`, stock: prev?.stock ?? 10 };
    });
  }, [sizes, v.slug, v.name, v.variants]);

  async function submit() {
    setError(null);
    if (!v.name || !v.mrp || !v.salePrice) {
      setError('Name, MRP and sale price are required.');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: v.name,
      slug: v.slug || undefined,
      status: v.status,
      brandId: v.brandId || undefined,
      gender: v.gender || undefined,
      mrp: Number(v.mrp),
      salePrice: Number(v.salePrice),
      shortDescription: v.shortDescription || undefined,
      description: v.description || undefined,
      fabricDetails: v.fabricDetails || undefined,
      careInstructions: v.careInstructions || undefined,
      categoryIds: v.categoryIds,
      ...Object.fromEntries(FLAGS.map((f) => [f.key, Boolean(v.flags[f.key])])),
      media: v.mediaText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((url) => ({ url })),
      options: variants.length
        ? [{ name: v.optionName, values: variants.map((x) => ({ value: x.value })) }]
        : [],
      variants: variants.map((x) => ({
        sku: x.sku,
        optionValues: [x.value],
        salePrice: Number(v.salePrice),
        stock: x.stock,
      })),
    };

    try {
      const saved = await apiFetch<{ id: string }>(
        isEdit ? `/admin/products/${v.id}` : '/admin/products',
        { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      router.push(`/products/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!v.id || !confirm('Archive this product? It stays in order history.')) return;
    await apiFetch(`/admin/products/${v.id}`, { method: 'DELETE' });
    router.push('/products');
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Card title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name">
              <Input value={v.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Slug" hint="Leave blank to auto-generate">
              <Input value={v.slug} onChange={(e) => set('slug', e.target.value)} />
            </Field>
            <Field label="Brand">
              <Select value={v.brandId} onChange={(e) => set('brandId', e.target.value)}>
                <option value="">— none —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gender">
              <Select value={v.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">— unset —</option>
                {['MEN', 'WOMEN', 'UNISEX', 'BOYS', 'GIRLS', 'BABY'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Short description">
              <Input
                value={v.shortDescription}
                onChange={(e) => set('shortDescription', e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description (HTML allowed)">
              <Textarea
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card title="Pricing">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="MRP (₹)">
              <Input
                type="number"
                value={v.mrp}
                onChange={(e) => set('mrp', e.target.value)}
              />
            </Field>
            <Field label="Sale price (₹)">
              <Input
                type="number"
                value={v.salePrice}
                onChange={(e) => set('salePrice', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card title="Variants & stock">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Option name">
              <Input value={v.optionName} onChange={(e) => set('optionName', e.target.value)} />
            </Field>
            <Field label="Values" hint="Comma-separated (e.g. sizes or colours)">
              <Input value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </Field>
          </div>
          {variants.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase text-[var(--color-muted)]">
                <tr>
                  <th className="py-2">{v.optionName}</th>
                  <th className="py-2">SKU</th>
                  <th className="py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((row, i) => (
                  <tr key={row.value} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pr-2">{row.value}</td>
                    <td className="py-2 pr-2">
                      <Input
                        value={row.sku}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...row, sku: e.target.value };
                          set('variants', next);
                        }}
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        value={String(row.stock)}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...row, stock: Number(e.target.value) };
                          set('variants', next);
                        }}
                        className="w-24"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Media">
          <MediaUploader
            onUploaded={(url) =>
              set('mediaText', v.mediaText ? `${v.mediaText}\n${url}` : url)
            }
          />
          <div className="mt-3">
            <Field label="Image URLs" hint="One per line. Uploaded files are added here automatically.">
              <Textarea
                value={v.mediaText}
                onChange={(e) => set('mediaText', e.target.value)}
                placeholder="https://…/front.jpg"
              />
            </Field>
          </div>
          {v.mediaText.trim() && (
            <div className="mt-3 flex flex-wrap gap-2">
              {v.mediaText
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, arbitrary external hosts
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded border border-[var(--color-line)] object-cover"
                  />
                ))}
            </div>
          )}
        </Card>

        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fabric">
              <Input
                value={v.fabricDetails}
                onChange={(e) => set('fabricDetails', e.target.value)}
              />
            </Field>
            <Field label="Care instructions">
              <Input
                value={v.careInstructions}
                onChange={(e) => set('careInstructions', e.target.value)}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Status">
          <Select value={v.status} onChange={(e) => set('status', e.target.value)}>
            {['DRAFT', 'ACTIVE', 'ARCHIVED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {error && <p className="mt-3 text-xs text-[var(--color-bad)]">{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
            </Button>
            {isEdit && (
              <Button variant="danger" onClick={remove}>
                Archive
              </Button>
            )}
          </div>
        </Card>

        <Card title="Merchandising">
          <div className="space-y-2">
            {FLAGS.map((f) => (
              <Checkbox
                key={f.key}
                label={f.label}
                checked={Boolean(v.flags[f.key])}
                onChange={(checked) => set('flags', { ...v.flags, [f.key]: checked })}
              />
            ))}
          </div>
        </Card>

        <Card title="Categories">
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {categories.map((c) => (
              <Checkbox
                key={c.id}
                label={c.parentId ? `— ${c.name}` : c.name}
                checked={v.categoryIds.includes(c.id)}
                onChange={(checked) =>
                  set(
                    'categoryIds',
                    checked
                      ? [...v.categoryIds, c.id]
                      : v.categoryIds.filter((x) => x !== c.id),
                  )
                }
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
