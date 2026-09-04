const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  mrp: string;
  salePrice: string;
  currency: string;
  ratingAverage: number;
  ratingCount: number;
  isNewArrival?: boolean;
  brand?: { name: string; slug: string } | null;
  media: { url: string; alt: string | null }[];
}

export interface HomeResponse {
  sections: {
    id: string;
    type: string;
    title: string | null;
    subtitle: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    products: ProductCard[];
    tiles: { label: string | null; imageUrl: string | null; url: string | null }[];
  }[];
  banners: {
    id: string;
    title: string;
    placement: string;
    headline: string | null;
    subheadline: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    imageUrl: string | null;
    imageMobileUrl: string | null;
    videoUrl: string | null;
    countdownEndsAt: string | null;
  }[];
  testimonials: { id: string; authorName: string; authorRole: string | null; quote: string; rating: number }[];
  collections: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    bannerUrl: string | null;
  }[];
  instagram: { id: string; imageUrl: string; permalink: string }[];
  lookbooks: { id: string; title: string; slug: string }[];
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  showInMenu: boolean;
  children: CategoryNode[];
}

// Bounds every server-side fetch so a hung/unreachable API surfaces a clear
// error (and the page's existing catch-fallback) within 15s instead of
// leaving the visitor on a blank/loading page indefinitely.
const FETCH_TIMEOUT_MS = 15_000;

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    next: { revalidate },
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  home: () => get<HomeResponse>('/storefront/home', 30),
  categories: () => get<CategoryNode[]>('/categories', 300),
  category: (slug: string) => get<Record<string, unknown>>(`/categories/${slug}`, 300),
  products: (qs: string) =>
    get<{ items: ProductCard[]; pagination: { page: number; totalPages: number; total: number } }>(
      `/products?${qs}`,
      30,
    ),
  product: (slug: string) => get<ProductDetail>(`/products/${slug}`, 30),
  collections: () => get<HomeResponse['collections']>('/collections', 300),
  collection: (slug: string) =>
    get<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      imageUrl: string | null;
      bannerUrl: string | null;
      bannerMobileUrl: string | null;
      _count: { products: number };
    }>(`/collections/${slug}`, 300),
  search: (q: string) =>
    get<{
      term: string;
      engine: string;
      suggestions: string[];
      products: ProductCard[];
    }>(`/storefront/search?q=${encodeURIComponent(q)}`, 0),
  facets: (qs: string) => get<Facets>(`/products/facets?${qs}`, 60),
};

export interface Facets {
  total: number;
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  brands: { slug: string; name: string }[];
  subcategories: { slug: string; name: string }[];
  price: { min: number; max: number };
}

export interface ProductSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
}

export interface ProductDetail extends ProductCard {
  description: string | null;
  shortDescription: string | null;
  metaTitle: string | null;
  seo: ProductSeo | null;
  fabricDetails: string | null;
  careInstructions: string | null;
  media: { url: string; alt: string | null; type: string }[];
  options: { id: string; name: string; values: { id: string; value: string; hexColor: string | null }[] }[];
  variants: {
    id: string;
    sku: string;
    salePrice: string | null;
    optionValues: { optionValue: { id: string; value: string } }[];
    inventory: { onHand: number; reserved: number }[];
  }[];
  categories: { category: { name: string; slug: string; path: string | null } }[];
  attributes: { value: string; attribute: { name: string; unit: string | null } }[];
  relatedFrom: { target: ProductCard }[];
  _count: { reviews: number };
}

export function formatPrice(value: string | number, currency = 'INR') {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function discountPct(mrp: string | number, sale: string | number) {
  const m = Number(mrp);
  const s = Number(sale);
  if (!m || s >= m) return 0;
  return Math.round(((m - s) / m) * 100);
}
