import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/ui/reveal';

export function EditorialCampaign({ image }: { image: string | null }) {
  return (
    <section className="bg-[var(--color-indigo-deep)] text-[var(--color-bone)]">
      <div className="grid lg:grid-cols-2">
        <div className="relative min-h-[60vh] lg:min-h-[80vh]">
          {image && (
            <Image
              src={image}
              alt="Slay Jeans denim campaign"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          )}
        </div>
        <Reveal className="flex items-center px-6 py-16 sm:px-12 lg:px-16">
          <div className="max-w-md">
            <p className="eyebrow text-[var(--color-accent-soft)]">The Denim Study</p>
            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-5xl">
              Raw indigo. Real fades.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--color-bone)]/75">
              From 13.5&nbsp;oz Japanese selvedge left raw to break in around the knees, to a
              mid-weight stretch that moves with you — every wash is chosen, every fit is
              wear-tested before it reaches the site.
            </p>
            <Link href="/collections/premium-collection" className="btn btn-light mt-8">
              Explore the Premium Collection
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
