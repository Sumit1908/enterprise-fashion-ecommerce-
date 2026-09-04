/**
 * Runs once when the Next.js server process starts (stable Next.js hook).
 * Keeps this Render free-tier service warm for staff, mirroring the identical
 * fix on the API (apps/api/src/main.ts) and the storefront
 * (apps/web/src/instrumentation.ts). /login does no server-side data fetching,
 * so the ping is near-zero-cost.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.KEEP_WARM === 'false') return;

  const base = (process.env.ADMIN_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const everyMs = Math.max(60_000, Number(process.env.KEEP_WARM_INTERVAL_SEC || 600) * 1000);
  const timer = setInterval(() => {
    fetch(`${base}/login`, { signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
  }, everyMs);
  timer.unref?.();
}
