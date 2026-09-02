import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export default nextConfig;
