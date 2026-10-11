import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

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
