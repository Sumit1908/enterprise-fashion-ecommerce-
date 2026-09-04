/**
 * Runs once when the Next.js server process starts (stable Next.js hook,
 * apps/web/README: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
 *
 * Render's free tier spins this service down after ~15 min with no inbound
 * traffic; the next visitor then eats a 20-50s cold start. Measured live on
 * production before this fix: a cold `https://velorhouse.in/` took 26.4s TTFB.
 * A periodic self-request to a near-zero-cost route (/robots.txt — no data
 * fetching) counts as inbound traffic and keeps the instance warm, mirroring
 * the identical, already-proven fix on the API (apps/api/src/main.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.KEEP_WARM === 'false') return;

  const base = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const everyMs = Math.max(60_000, Number(process.env.KEEP_WARM_INTERVAL_SEC || 600) * 1000);
  const timer = setInterval(() => {
    fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
  }, everyMs);
  timer.unref?.();
}
