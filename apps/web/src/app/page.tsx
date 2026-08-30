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
    <section className="relative flex min-h-[78vh] items-center overflow-hidden sm:min-h-[70vh]">
      {hero.imageUrl && (
        <Image
          src={hero.imageUrl}
          alt={hero.headline ?? hero.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 sm:bg-gradient-to-r sm:from-black/60 sm:to-transparent" />
      <div className="container-wide relative z-10 py-16 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-white/80 sm:text-sm">{hero.title}</p>
        <h1 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
          {hero.headline}
        </h1>
        {hero.subheadline && (
          <p className="mt-4 max-w-md text-base text-white/85 sm:text-lg">{hero.subheadline}</p>
        )}
        {hero.ctaUrl && (
          <Link
            href={hero.ctaUrl}
            className="mt-7 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-accent)] hover:text-white"
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
        <div className="container-wide grid grid-cols-2 gap-y-4 py-6 sm:divide-x sm:divide-[var(--color-sand)] sm:py-0 md:grid-cols-4">
          {PROMISES.map(([title, sub]) => (
            <div key={title} className="px-3 text-center sm:py-6">
              <p className="text-xs font-semibold sm:text-sm">{title}</p>
              <p className="mt-1 text-[11px] text-[var(--color-ink-soft)] sm:text-xs">{sub}</p>
            </div>
          ))}
        </div>
      </section>
      <HomeSections data={data} />
    </>
  );
}
