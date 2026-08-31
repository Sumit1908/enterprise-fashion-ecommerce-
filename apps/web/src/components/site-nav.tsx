'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CategoryNode } from '@/lib/api';
import { FITS } from '@/lib/fits';

interface NavGroup {
  label: string;
  href: string;
  columns?: { heading: string; links: { label: string; href: string }[] }[];
}

function buildGroups(tree: CategoryNode[]): NavGroup[] {
  const find = (slug: string) => tree.find((c) => c.slug === slug);
  const kids = (node?: CategoryNode) =>
    (node?.children ?? [])
      .filter((c) => c.showInMenu)
      .slice(0, 12)
      .map((c) => ({ label: c.name, href: `/c/${c.slug}` }));

  const women = find('women');
  const men = find('men');
  const others = tree
    .filter((c) => !['men', 'women', 'kids'].includes(c.slug) && c.showInMenu)
    .map((c) => ({ label: c.name, href: `/c/${c.slug}` }));

  return [
    { label: 'New In', href: '/collections/new-arrivals' },
    {
      label: 'Women',
      href: '/c/women',
      columns: [
        { heading: 'Categories', links: kids(women) },
        {
          heading: 'Shop by Fit',
          links: FITS.map((f) => ({ label: f.label, href: `/search?q=${f.query}` })),
        },
      ],
    },
    {
      label: 'Men',
      href: '/c/men',
      columns: [
        { heading: 'Categories', links: kids(men) },
        {
          heading: 'Shop by Fit',
          links: FITS.map((f) => ({ label: f.label, href: `/search?q=${f.query}` })),
        },
      ],
    },
    { label: 'Kids', href: '/c/kids' },
    {
      label: 'Collections',
      href: '/collections/new-arrivals',
      columns: [
        {
          heading: 'Explore',
          links: [
            { label: 'New Arrivals', href: '/collections/new-arrivals' },
            { label: 'Premium Collection', href: '/collections/premium-collection' },
            { label: 'Summer Edit', href: '/collections/summer-edit' },
            { label: 'Sale', href: '/collections/sale' },
          ],
        },
        ...(others.length ? [{ heading: 'More', links: others }] : []),
      ],
    },
  ];
}

export function SiteNav({ tree }: { tree: CategoryNode[] }) {
  const groups = buildGroups(tree);
  const [active, setActive] = useState<string | null>(null);

  return (
    <nav
      className="hidden items-stretch lg:flex"
      onMouseLeave={() => setActive(null)}
    >
      {groups.map((group) => (
        <div
          key={group.label}
          className="flex items-stretch"
          onMouseEnter={() => setActive(group.columns ? group.label : null)}
        >
          <Link
            href={group.href}
            className="relative flex items-center px-4 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
          >
            {group.label}
            {group.columns && active === group.label && (
              <span className="absolute inset-x-4 -bottom-px h-px bg-[var(--color-ink)]" />
            )}
          </Link>

          {group.columns && active === group.label && (
            <div className="absolute inset-x-0 top-full z-40 border-t border-[var(--color-sand)] bg-[var(--color-paper)] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.25)]">
              <div className="mx-auto grid max-w-[88rem] grid-cols-2 gap-10 px-10 py-8 md:grid-cols-4">
                {group.columns.map((col) => (
                  <div key={col.heading}>
                    <p className="eyebrow">{col.heading}</p>
                    <ul className="mt-4 space-y-2.5">
                      {col.links.map((link) => (
                        <li key={link.href + link.label}>
                          <Link
                            href={link.href}
                            className="link-underline text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="hidden md:block">
                  <p className="eyebrow">This Season</p>
                  <p className="mt-4 font-display text-lg leading-snug">
                    The Autumn Denim Drop
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                    New washes and considered fits, in limited runs.
                  </p>
                  <Link
                    href="/collections/new-arrivals"
                    className="link-underline mt-3 inline-block text-xs font-semibold uppercase tracking-[0.14em]"
                  >
                    Shop the drop
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <Link
        href="/collections/sale"
        className="flex items-center px-4 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[var(--color-sale)] transition-colors hover:opacity-70"
      >
        Sale
      </Link>
    </nav>
  );
}
