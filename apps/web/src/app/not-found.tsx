import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-wide py-32 text-center">
      <p className="font-display text-6xl font-semibold">404</p>
      <h1 className="mt-4 text-xl font-medium">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        The link may be broken or the product may no longer be available.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-[var(--color-ink)] px-8 py-3 text-sm font-semibold text-white"
      >
        Back to home
      </Link>
    </div>
  );
}
