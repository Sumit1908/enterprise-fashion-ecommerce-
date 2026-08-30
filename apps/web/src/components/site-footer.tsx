import Link from 'next/link';
import { SITE } from '@/lib/site';

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: 'Shop',
    links: [
      ['New In', '/collections/new-arrivals'],
      ['Women', '/c/women'],
      ['Men', '/c/men'],
      ['Kids', '/c/kids'],
      ['Shop All', '/shop'],
      ['Sale', '/collections/sale'],
    ],
  },
  {
    title: 'Client Care',
    links: [
      ['Track Order', '/account/orders'],
      ['Contact Us', '/pages/contact'],
      ['Shipping Policy', '/pages/shipping-policy'],
      ['Return & Refund Policy', '/pages/returns-refunds'],
      ['Cancellation Policy', '/pages/cancellation-policy'],
      ['Size Guide', '/pages/size-guide'],
      ['FAQs', '/pages/faq'],
    ],
  },
  {
    title: 'The House',
    links: [
      ['About Us', '/pages/about'],
      ['Privacy Policy', '/pages/privacy'],
      ['Terms & Conditions', '/pages/terms'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-[var(--color-ink)] text-[var(--color-bone)]">
      <div className="container-wide grid gap-12 py-16 md:grid-cols-[1.6fr_repeat(3,1fr)] lg:py-20">
        <div>
          <p className="font-display text-2xl uppercase tracking-[0.2em]">Slay&nbsp;Jeans</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--color-bone)]/65">
            Premium denim, considered fits and limited runs — designed in-house and made to be
            worn for years, not seasons.
          </p>

          <address className="mt-6 space-y-1 text-sm not-italic text-[var(--color-bone)]/65">
            <p>{SITE.address.line1}</p>
            <p>
              {SITE.address.city}, {SITE.address.state} – {SITE.address.pincode}, {SITE.address.country}
            </p>
            <p className="pt-1">
              <a href={`mailto:${SITE.email}`} className="link-underline hover:text-[var(--color-bone)]">
                {SITE.email}
              </a>
            </p>
            <p>
              <a href={SITE.whatsappUrl} className="link-underline hover:text-[var(--color-bone)]">
                WhatsApp / Call {SITE.phoneDisplay}
              </a>
            </p>
            <p className="text-xs text-[var(--color-bone)]/45">{SITE.supportHours}</p>
          </address>

          <div className="mt-6 flex gap-4 text-[var(--color-bone)]/70">
            <a href="https://instagram.com" aria-label="Instagram" className="hover:text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href={SITE.whatsappUrl} aria-label="WhatsApp" className="hover:text-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 20l1.4-4A8 8 0 1 1 8 18.6L4 20z" />
                <path d="M9 9c0 4 2 6 6 6M9 9c0-1 .5-1.5 1-1.5M15 15c1 0 1.5-.5 1.5-1" />
              </svg>
            </a>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="eyebrow text-[var(--color-bone)]/90">{col.title}</h3>
            <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-bone)]/65">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="link-underline hover:text-[var(--color-bone)]">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-wide flex flex-col items-center justify-between gap-3 py-6 text-xs text-[var(--color-bone)]/45 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {SITE.name}. {SITE.address.city}, {SITE.address.state}, India.
          </p>
          <p className="tracking-wide">Secure checkout · SSL encrypted · Cash on Delivery available</p>
        </div>
      </div>
    </footer>
  );
}
