import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Opt-in standalone output for Docker; set by the Dockerfile.
  ...(process.env.BUILD_STANDALONE === '1'
    ? { output: 'standalone', outputFileTracingRoot: workspaceRoot }
    : {}),
};

export default nextConfig;
