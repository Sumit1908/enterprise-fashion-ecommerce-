import Image from 'next/image';
import Link from 'next/link';
import { api, type HomeResponse } from '@/lib/api';
import { HomeSections } from '@/components/home-sections';

export const revalidate = 30;

async function getHome(): Promise<HomeResponse | null> {
  try {
    return await api.home();
  } catch {
    return null;
  }
}

function Hero({ data }: { data: HomeResponse }) {
  const hero = data.banners.find((b) => b.placement === 'HOME_HERO');
  if (!hero) return null;
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden">
      {hero.imageUrl && (
        <Image
          src={hero.imageUrl}
          alt={hero.headline ?? hero.title}
          fill
          priority
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-black/10" />
      <div className="container-wide relative z-10 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-white/80">{hero.title}</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold sm:text-6xl">
          {hero.headline}
        </h1>
        {hero.subheadline && (
          <p className="mt-4 max-w-lg text-lg text-white/80">{hero.subheadline}</p>
        )}
        {hero.ctaUrl && (
          <Link
            href={hero.ctaUrl}
            className="mt-8 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-accent)] hover:text-white"
          >
            {hero.ctaLabel ?? 'Shop now'}
          </Link>
        )}
      </div>
    </section>
  );
}

const PROMISES: [string, string][] = [
  ['Free Shipping', 'On orders over ₹999'],
  ['Easy Returns', '7-day hassle-free returns'],
  ['Secure Payments', 'Razorpay · Stripe · UPI'],
  ['Cash on Delivery', 'Available across India'],
];

export default async function HomePage() {
  const data = await getHome();

  if (!data) {
    return (
      <div className="container-wide py-32 text-center">
        <h1 className="font-display text-3xl font-semibold">Storefront is warming up</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          The API isn&apos;t reachable yet. Start it with <code>pnpm dev</code> and make sure the
          database is seeded (<code>pnpm db:seed</code>).
        </p>
      </div>
    );
  }

  return (
    <>
      <Hero data={data} />
      <section className="border-y border-[var(--color-sand)] bg-[var(--color-paper)]">
        <div className="container-wide grid grid-cols-2 divide-x divide-[var(--color-sand)] md:grid-cols-4">
          {PROMISES.map(([title, sub]) => (
            <div key={title} className="px-4 py-6 text-center">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{sub}</p>
            </div>
          ))}
        </div>
      </section>
      <HomeSections data={data} />
    </>
  );
}
