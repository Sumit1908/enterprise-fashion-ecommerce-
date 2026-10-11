import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for Docker — opt-in so local Windows builds
  // (where Next's symlink tracing fails) are unaffected. The Dockerfile sets it.
  ...(process.env.BUILD_STANDALONE === '1'
    ? { output: 'standalone', outputFileTracingRoot: workspaceRoot }
    : {}),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    // 75 = next/image's own default (used everywhere we don't pass `quality`).
    // 85 = the homepage hero only (components/home/hero-slider.tsx) — a
    // deliberately higher bar for the single largest, most visible image on
    // the site. Required allow-list for any non-default value (Next 15
    // warns, Next 16 will hard-require it).
    qualities: [75, 85],
  },
  async redirects() {
    return [
      // Older combined page split into two policy pages.
      { source: '/pages/shipping-returns', destination: '/pages/shipping-policy', permanent: true },
      // Canonical domain. The Render default hostname permanently (308) redirects
      // to velorhouse.in, keeping the full path and query string. The `has` host
      // guard means it never fires once the visitor is on velorhouse.in — no loop.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'slay-jeans-web.onrender.com' }],
        destination: 'https://velorhouse.in/:path*',
        permanent: true,
      },
    ];
  },
};

// NEXT_PUBLIC_API_URL is inlined into the browser bundle at build time. Without
// it the bundle silently falls back to http://localhost:4000 and every cart,
// login and checkout call fails in production — so on Render (which sets
// RENDER=true) refuse to build without it. Local, CI and Docker builds are unaffected.
export default function config(phase) {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.RENDER && !process.env.NEXT_PUBLIC_API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to this Render service's Environment (e.g. https://slay-jeans-api.onrender.com) and redeploy.",
    );
  }
  return nextConfig;
}
