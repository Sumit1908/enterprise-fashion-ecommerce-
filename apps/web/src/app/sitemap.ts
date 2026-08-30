import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

const base = process.env.WEB_URL ?? 'http://localhost:3000';

const INFO_PAGES = ['about', 'contact', 'shipping-returns', 'size-guide', 'faq', 'privacy', 'terms'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    ...INFO_PAGES.map((slug) => ({
      url: `${base}/pages/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ];

  try {
    const flatten = (nodes: Awaited<ReturnType<typeof api.categories>>): void => {
      for (const node of nodes) {
        entries.push({ url: `${base}/c/${node.slug}`, changeFrequency: 'daily', priority: 0.8 });
        if (node.children?.length) flatten(node.children);
      }
    };
    flatten(await api.categories());

    for (const c of await api.collections()) {
      entries.push({ url: `${base}/collections/${c.slug}`, changeFrequency: 'daily', priority: 0.7 });
    }

    const { items } = await api.products('pageSize=200&sort=latest');
    for (const p of items) {
      entries.push({ url: `${base}/p/${p.slug}`, changeFrequency: 'weekly', priority: 0.6 });
    }
  } catch {
    // API unavailable at build time — return what we have.
  }

  return entries;
}
