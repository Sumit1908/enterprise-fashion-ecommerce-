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
export interface Colour {
  name: string;
  hex: string;
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
  collectionIds: string[];
  tags: string;
  metaTitle: string;
  metaDescription: string;
  lowStockThreshold: string;
  mediaText: string;
  sizes: string;
  colours: Colour[];
  /** stock + sku + optional price override, keyed by combo id ("size" | "colour" | "size||colour") */
  stock: Record<string, number>;
  skus: Record<string, string>;
  prices: Record<string, string>;
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
  collectionIds: [],
  tags: '',
  metaTitle: '',
  metaDescription: '',
  lowStockThreshold: '5',
  mediaText: '',
  sizes: '28, 30, 32, 34, 36',
  colours: [],
  stock: {},
  skus: {},
  prices: {},
};

const parseList = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

/** Image URLs — one per line (a URL may itself contain commas). */
const parseLines = (s: string) =>
  s.split('\n').map((x) => x.trim()).filter(Boolean);

const comboKey = (size: string | null, colour: string | null) =>
  [size, colour].filter(Boolean).join('||');

export function ProductForm({ initial }: { initial?: Partial<ProductFormValue> }) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValue>({ ...EMPTY, ...initial });
  const [brands, setBrands] = useState<Ref[]>([]);
  const [categories, setCategories] = useState<(Ref & { parentId: string | null })[]>([]);
  const [collections, setCollections] = useState<Ref[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const isEdit = Boolean(v.id);

  useEffect(() => {
    apiFetch<Ref[]>('/admin/brands').then(setBrands).catch(() => undefined);
    apiFetch<(Ref & { parentId: string | null })[]>('/admin/categories')
      .then(setCategories)
      .catch(() => undefined);
    apiFetch<Ref[]>('/admin/collections').then(setCollections).catch(() => undefined);
    apiFetch<{ available: boolean }>('/admin/products/ai-suggest/config')
      .then((c) => setAiAvailable(c.available))
      .catch(() => undefined);
  }, []);

  interface AiSuggestion {
    name?: string;
    brand?: string;
    gender?: string;
    colour?: string;
    category?: string;
    shortDescription?: string;
    description?: string;
    tags?: string[];
    material?: string;
    style?: string;
    notes?: string;
  }

  async function runAiSuggest() {
    const imageUrl = parseLines(v.mediaText)[0];
    if (!imageUrl) {
      setAiNote('Upload a product image first.');
      return;
    }
    setAiBusy(true);
    setAiNote(null);
    try {
      const { suggestions } = await apiFetch<{ suggestions: AiSuggestion; disclaimer: string }>(
        '/admin/products/ai-suggest',
        { method: 'POST', body: JSON.stringify({ imageUrl }) },
      );
      // Fill only blank fields — never overwrite what the editor already typed.
      setV((p) => {
        const next = { ...p };
        if (!next.name && suggestions.name) next.name = suggestions.name;
        if (!next.shortDescription && suggestions.shortDescription)
          next.shortDescription = suggestions.shortDescription;
        if (!next.description && suggestions.description) next.description = suggestions.description;
        if (!next.gender && suggestions.gender) next.gender = suggestions.gender;
        if (!next.fabricDetails && suggestions.material) next.fabricDetails = suggestions.material;
        if (!next.tags && suggestions.tags?.length) next.tags = suggestions.tags.join(', ');
        const brandMatch = suggestions.brand
          ? brands.find((b) => b.name.toLowerCase() === suggestions.brand!.toLowerCase())
          : undefined;
        if (!next.brandId && brandMatch) next.brandId = brandMatch.id;
        return next;
      });
      const extra: string[] = [];
      if (suggestions.colour) extra.push(`colour: ${suggestions.colour}`);
      if (suggestions.category) extra.push(`category: ${suggestions.category}`);
      if (suggestions.style) extra.push(`style: ${suggestions.style}`);
      if (suggestions.brand && !brands.some((b) => b.name.toLowerCase() === suggestions.brand!.toLowerCase()))
        extra.push(`brand seen: ${suggestions.brand}`);
      setAiNote(
        'AI suggestions applied to empty fields — review before saving.' +
          (extra.length ? ` Also noted — ${extra.join(' · ')}.` : '') +
          (suggestions.notes ? ` (${suggestions.notes})` : ''),
      );
    } catch (e) {
      setAiNote((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const sizeList = useMemo(() => parseList(v.sizes), [v.sizes]);
  const colourList = useMemo(
    () => v.colours.map((c) => c.name.trim()).filter(Boolean),
    [v.colours],
  );

  const skuBase = useMemo(
    () =>
      (v.slug || v.name || 'sku')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 12),
    [v.slug, v.name],
  );

  /** Every size×colour combination (or single-axis, or one default row). */
  const matrix = useMemo(() => {
    const rows: { key: string; size: string | null; colour: string | null }[] = [];
    if (sizeList.length && colourList.length) {
      for (const size of sizeList)
        for (const colour of colourList)
          rows.push({ key: comboKey(size, colour), size, colour });
    } else if (sizeList.length) {
      for (const size of sizeList) rows.push({ key: comboKey(size, null), size, colour: null });
    } else if (colourList.length) {
      for (const colour of colourList)
        rows.push({ key: comboKey(null, colour), size: null, colour });
    }
    return rows.map((r) => {
      const auto = [skuBase, r.size, r.colour ? r.colour.toUpperCase().replace(/[^A-Z0-9]+/g, '') : null]
        .filter(Boolean)
        .join('-');
      return {
        ...r,
        sku: v.skus[r.key] || auto,
        stock: v.stock[r.key] ?? 10,
        price: v.prices[r.key] ?? '',
      };
    });
  }, [sizeList, colourList, skuBase, v.skus, v.stock, v.prices]);

  function setColour(i: number, patch: Partial<Colour>) {
    const next = v.colours.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    set('colours', next);
  }

  async function submit() {
    setError(null);
    if (!v.name || !v.mrp || !v.salePrice) {
      setError('Name, MRP and sale price are required.');
      return;
    }
    if (Number(v.salePrice) > Number(v.mrp)) {
      setError('Sale price cannot exceed MRP.');
      return;
    }
    if (matrix.length === 0) {
      setError('Add at least one size or colour so the product is purchasable.');
      return;
    }
    const badPrice = matrix.find((r) => r.price && Number(r.price) > Number(v.mrp));
    if (badPrice) {
      setError(`Variant price for "${[badPrice.size, badPrice.colour].filter(Boolean).join(' / ')}" cannot exceed MRP.`);
      return;
    }
    setSaving(true);

    const options: { name: string; values: { value: string; hexColor?: string }[] }[] = [];
    if (sizeList.length) {
      options.push({ name: 'Size', values: sizeList.map((value) => ({ value })) });
    }
    if (colourList.length) {
      options.push({
        name: 'Colour',
        values: v.colours
          .filter((c) => c.name.trim())
          .map((c) => ({ value: c.name.trim(), hexColor: /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : undefined })),
      });
    }

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
      collectionIds: v.collectionIds,
      tags: parseList(v.tags),
      lowStockThreshold:
        v.lowStockThreshold.trim() !== '' && Number.isFinite(Number(v.lowStockThreshold))
          ? Math.max(0, Math.trunc(Number(v.lowStockThreshold)))
          : undefined,
      seo:
        v.metaTitle.trim() || v.metaDescription.trim()
          ? {
              metaTitle: v.metaTitle.trim() || undefined,
              metaDescription: v.metaDescription.trim() || undefined,
            }
          : undefined,
      ...Object.fromEntries(FLAGS.map((f) => [f.key, Boolean(v.flags[f.key])])),
      media: parseLines(v.mediaText).map((url) => ({ url })),
      options,
      variants: matrix.map((row) => ({
        sku: row.sku,
        optionValues: [row.size, row.colour].filter((x): x is string => Boolean(x)),
        salePrice: row.price && Number.isFinite(Number(row.price)) ? Number(row.price) : Number(v.salePrice),
        stock: Number.isFinite(row.stock) ? row.stock : 0,
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

  const mediaUrls = parseLines(v.mediaText);

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
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Gender">
              <Select value={v.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">— unset —</option>
                {['MEN', 'WOMEN', 'UNISEX', 'BOYS', 'GIRLS', 'BABY'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Short description">
              <Input value={v.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description (HTML allowed)">
              <Textarea value={v.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Tags" hint="Comma-separated, used for search & automated collections">
              <Input value={v.tags} onChange={(e) => set('tags', e.target.value)} placeholder="slim, stretch, everyday" />
            </Field>
          </div>
        </Card>

        <Card title="Pricing">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="MRP (₹)">
              <Input type="number" value={v.mrp} onChange={(e) => set('mrp', e.target.value)} />
            </Field>
            <Field label="Sale price (₹)">
              <Input type="number" value={v.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Sizes, colours & stock">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sizes" hint="Comma-separated. Leave blank for a colour-only product.">
              <Input value={v.sizes} onChange={(e) => set('sizes', e.target.value)} placeholder="28, 30, 32" />
            </Field>
            <div>
              <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Colours</span>
              <div className="space-y-2">
                {v.colours.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={c.name}
                      placeholder="Indigo"
                      onChange={(e) => setColour(i, { name: e.target.value })}
                    />
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#2f4058'}
                      onChange={(e) => setColour(i, { hex: e.target.value })}
                      className="h-9 w-10 shrink-0 rounded border border-[var(--color-line)]"
                      aria-label={`Colour swatch ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => set('colours', v.colours.filter((_, idx) => idx !== i))}
                      className="shrink-0 px-2 text-sm text-[var(--color-bad)]"
                      aria-label="Remove colour"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  onClick={() => set('colours', [...v.colours, { name: '', hex: '#2f4058' }])}
                >
                  + Add colour
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Field
              label="Low-stock alert threshold"
              hint="Flags a variant as low stock on the Inventory page when its quantity falls to this or below. Applies to every variant."
            >
              <Input
                type="number"
                className="max-w-[8rem]"
                value={v.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', e.target.value)}
              />
            </Field>
          </div>

          {matrix.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase text-[var(--color-muted)]">
                <tr>
                  {sizeList.length > 0 && <th className="py-2 pr-2">Size</th>}
                  {colourList.length > 0 && <th className="py-2 pr-2">Colour</th>}
                  <th className="py-2 pr-2">SKU</th>
                  <th className="py-2 pr-2">Price ₹</th>
                  <th className="py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.key} className="border-t border-[var(--color-line)]">
                    {sizeList.length > 0 && <td className="py-2 pr-2">{row.size}</td>}
                    {colourList.length > 0 && <td className="py-2 pr-2">{row.colour}</td>}
                    <td className="py-2 pr-2">
                      <Input
                        value={row.sku}
                        onChange={(e) => set('skus', { ...v.skus, [row.key]: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        className="w-24"
                        placeholder={v.salePrice || 'base'}
                        value={row.price}
                        onChange={(e) => set('prices', { ...v.prices, [row.key]: e.target.value })}
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        className="w-24"
                        value={String(row.stock)}
                        onChange={(e) =>
                          set('stock', { ...v.stock, [row.key]: Number(e.target.value) })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Media">
          <div className="flex flex-wrap items-center gap-2">
            <MediaUploader
              value={mediaUrls}
              onChange={(urls) => set('mediaText', urls.join('\n'))}
            />
            {aiAvailable && (
              <button
                type="button"
                onClick={() => void runAiSuggest()}
                disabled={aiBusy || mediaUrls.length === 0}
                className="rounded-md border border-[var(--color-line)] px-3 py-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-brand)] disabled:opacity-50"
              >
                {aiBusy ? 'Analysing…' : 'Suggest details with AI'}
              </button>
            )}
          </div>
          {aiNote && (
            <p className="mt-2 rounded-md bg-[var(--color-canvas)] p-2 text-xs text-[var(--color-muted)]">
              {aiNote}
            </p>
          )}
          <div className="mt-3">
            <Field label="Image URLs" hint="One per line. Uploaded files are added here automatically.">
              <Textarea
                value={v.mediaText}
                onChange={(e) => set('mediaText', e.target.value)}
                placeholder="https://…/front.jpg"
              />
            </Field>
          </div>
        </Card>

        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fabric">
              <Input value={v.fabricDetails} onChange={(e) => set('fabricDetails', e.target.value)} />
            </Field>
            <Field label="Care instructions">
              <Input value={v.careInstructions} onChange={(e) => set('careInstructions', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Search engine listing (SEO)">
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            How this product shows on Google. Leave blank to fall back to the product name and short
            description.
          </p>
          <Field label="Meta title" hint={`${v.metaTitle.length} chars · ~60 shows in Google`}>
            <Input
              value={v.metaTitle}
              maxLength={180}
              placeholder={v.name || 'Product name'}
              onChange={(e) => set('metaTitle', e.target.value)}
            />
          </Field>
          <div className="mt-4">
            <Field
              label="Meta description"
              hint={`${v.metaDescription.length} chars · ~155 shows in Google`}
            >
              <Textarea
                value={v.metaDescription}
                maxLength={400}
                placeholder={v.shortDescription || 'A short, compelling summary of the product.'}
                onChange={(e) => set('metaDescription', e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            URL: <span className="font-mono">/p/{v.slug || '(auto from name)'}</span>
          </p>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Status">
          <Select value={v.status} onChange={(e) => set('status', e.target.value)}>
            {['DRAFT', 'ACTIVE', 'ARCHIVED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          {error && <p className="mt-3 text-xs text-[var(--color-bad)]">{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
            </Button>
            {isEdit && (
              <Button variant="danger" onClick={remove}>Archive</Button>
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

        <Card title="Collections">
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {collections.length === 0 && (
              <p className="text-xs text-[var(--color-muted)]">No collections yet.</p>
            )}
            {collections.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={v.collectionIds.includes(c.id)}
                onChange={(checked) =>
                  set(
                    'collectionIds',
                    checked
                      ? [...v.collectionIds, c.id]
                      : v.collectionIds.filter((x) => x !== c.id),
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
