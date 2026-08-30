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
};

export default nextConfig;
