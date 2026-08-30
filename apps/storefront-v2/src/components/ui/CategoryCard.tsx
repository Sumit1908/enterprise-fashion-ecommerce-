import Image from 'next/image';
import Link from 'next/link';
import type { CategoryCardData } from '@/lib/data/categories';

export function CategoryCard({
  item,
  ratio = 'portrait',
  className = '',
}: {
  item: CategoryCardData;
  ratio?: 'portrait' | 'editorial';
  className?: string;
}) {
  return (
    <Link href={item.href} className={`group block ${className}`}>
      <div
        className={`relative overflow-hidden rounded-[var(--radius-img)] bg-[var(--color-gray-50)] ${
          ratio === 'editorial' ? 'aspect-[3/2]' : 'aspect-[3/4]'
        }`}
      >
        <Image
          src={item.image}
          alt={item.label}
          fill
          sizes="(max-width:640px) 60vw, (max-width:1024px) 33vw, 20vw"
          className="object-cover transition-transform duration-[700ms] ease-out group-hover:scale-105"
        />
      </div>
      <p className="mt-2.5 text-center text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink)]">
        {item.label}
      </p>
    </Link>
  );
}
