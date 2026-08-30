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
  media: { url: string }[];
  options: { name: string; values: { value: string }[] }[];
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

function toForm(p: ApiProduct): ProductFormValue {
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
    mediaText: p.media.map((m) => m.url).join('\n'),
    optionName: p.options[0]?.name ?? 'Size',
    variants: p.variants.map((variant) => ({
      sku: variant.sku,
      value: variant.optionValues[0]?.optionValue.value ?? '',
      stock: variant.inventory.reduce((sum, i) => sum + i.onHand, 0),
    })),
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
