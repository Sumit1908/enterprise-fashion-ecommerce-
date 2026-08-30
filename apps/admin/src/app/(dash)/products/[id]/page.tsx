'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { ProductForm, type ProductFormValue } from '@/components/product-form';

interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  gender: string | null;
  mrp: string;
  salePrice: string;
  shortDescription: string | null;
  description: string | null;
  fabricDetails: string | null;
  careInstructions: string | null;
  brand: { id: string; name: string } | null;
  categories: { categoryId: string }[];
  collections: { collectionId: string }[];
  tags: { tag: { name: string } }[];
  media: { url: string }[];
  options: { name: string; values: { value: string; hexColor: string | null }[] }[];
  variants: {
    sku: string;
    optionValues: { optionValue: { value: string } }[];
    inventory: { onHand: number }[];
  }[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isTrending: boolean;
  isHot: boolean;
  isStaffPick: boolean;
  isExclusive: boolean;
}

const FLAG_KEYS = [
  'isFeatured',
  'isBestSeller',
  'isNewArrival',
  'isTrending',
  'isHot',
  'isStaffPick',
  'isExclusive',
] as const;

const isColourOption = (name: string) => /colou?r/i.test(name);
const isSizeOption = (name: string) => /size/i.test(name);

function toForm(p: ApiProduct): ProductFormValue {
  const sizeOpt = p.options.find((o) => isSizeOption(o.name)) ?? p.options.find((o) => !isColourOption(o.name));
  const colourOpt = p.options.find((o) => isColourOption(o.name));

  const sizeValues = new Set(sizeOpt?.values.map((x) => x.value) ?? []);
  const colourValues = new Set(colourOpt?.values.map((x) => x.value) ?? []);

  const stock: Record<string, number> = {};
  const skus: Record<string, string> = {};
  for (const variant of p.variants) {
    const vals = variant.optionValues.map((o) => o.optionValue.value);
    const size = vals.find((x) => sizeValues.has(x)) ?? null;
    const colour = vals.find((x) => colourValues.has(x)) ?? null;
    const key = [size, colour].filter(Boolean).join('||');
    if (!key) continue;
    stock[key] = variant.inventory.reduce((sum, i) => sum + i.onHand, 0);
    skus[key] = variant.sku;
  }

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    brandId: p.brand?.id ?? '',
    gender: p.gender ?? '',
    mrp: p.mrp,
    salePrice: p.salePrice,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    fabricDetails: p.fabricDetails ?? '',
    careInstructions: p.careInstructions ?? '',
    flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, p[k]])),
    categoryIds: p.categories.map((c) => c.categoryId),
    collectionIds: p.collections?.map((c) => c.collectionId) ?? [],
    tags: (p.tags ?? []).map((t) => t.tag.name).join(', '),
    mediaText: p.media.map((m) => m.url).join('\n'),
    sizes: (sizeOpt?.values ?? []).map((x) => x.value).join(', '),
    colours: (colourOpt?.values ?? []).map((x) => ({ name: x.value, hex: x.hexColor ?? '#2f4058' })),
    stock,
    skus,
  };
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<ProductFormValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ApiProduct>(`/admin/products/${id}`)
      .then((p) => setInitial(toForm(p)))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!initial) return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;

  return (
    <>
      <PageHeader title={initial.name} subtitle={`/${initial.slug}`} />
      <div className="mb-4">
        <Link href="/products" className="text-sm text-[var(--color-brand)]">
          ← All products
        </Link>
      </div>
      <ProductForm initial={initial} />
    </>
  );
}
