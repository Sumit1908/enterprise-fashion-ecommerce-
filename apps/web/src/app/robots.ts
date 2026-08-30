import type { MetadataRoute } from 'next';

const base = process.env.WEB_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account', '/cart', '/checkout', '/order', '/wishlist', '/newsletter'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
