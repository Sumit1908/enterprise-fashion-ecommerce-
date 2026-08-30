import Link from 'next/link';

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: 'Shop',
    links: [
      ['New Arrivals', '/collections/new-arrivals'],
      ['Men', '/c/men'],
      ['Women', '/c/women'],
      ['Kids', '/c/kids'],
      ['Sale', '/collections/sale'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Track Order', '/account/orders'],
      ['Shipping & Returns', '/pages/shipping-returns'],
      ['Size Guide', '/pages/size-guide'],
      ['Contact Us', '/pages/contact'],
      ['FAQs', '/pages/faq'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Our Story', '/pages/about'],
      ['Privacy Policy', '/pages/privacy'],
      ['Terms of Service', '/pages/terms'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--color-sand)] bg-[var(--color-ink)] text-[var(--color-bone)]">
      <div className="container-wide grid gap-12 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <p className="font-display text-2xl font-semibold">Slay Jeans</p>
          <p className="mt-3 max-w-xs text-sm text-[var(--color-bone)]/70">
            Premium denim, considered fits and limited runs. Designed to be worn for years.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wider">{col.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-bone)]/70">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-[var(--color-accent)]">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-wide flex flex-col items-center justify-between gap-2 py-6 text-xs text-[var(--color-bone)]/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Slay Jeans. All rights reserved.</p>
          <p>Secure checkout · SSL encrypted · Cash on Delivery available</p>
        </div>
      </div>
    </footer>
  );
}
