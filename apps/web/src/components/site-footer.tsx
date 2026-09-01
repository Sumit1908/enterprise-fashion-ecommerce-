import Link from 'next/link';
import { SITE } from '@/lib/site';

const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Quick Shop',
    links: [
      { label: 'New Arrivals', href: '/collections/new-arrivals' },
      { label: 'Best Sellers', href: '/shop?sort=bestselling' },
      { label: 'Trending Now', href: '/shop?sort=popular' },
      { label: 'Shop All', href: '/shop' },
      { label: 'Sale', href: '/collections/sale' },
    ],
  },
  {
    title: 'Helpful Links',
    links: [
      { label: 'About Us', href: '/pages/about' },
      { label: 'Contact Us', href: '/pages/contact' },
      { label: 'Track Order', href: '/account/orders' },
      { label: 'Size Guide', href: '/pages/size-guide' },
      { label: 'FAQs', href: '/pages/faq' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'Shipping Policy', href: '/pages/shipping-policy' },
      { label: 'Return & Refund Policy', href: '/pages/returns-refunds' },
      { label: 'Cancellation Policy', href: '/pages/cancellation-policy' },
      { label: 'Privacy Policy', href: '/pages/privacy' },
      { label: 'Terms & Conditions', href: '/pages/terms' },
    ],
  },
];

function ColumnLinks({ links }: { links: { label: string; href: string; external?: boolean }[] }) {
  return (
    <ul className="mt-5 space-y-3 text-sm text-[var(--color-ink-soft)]">
      {links.map((l) => (
        <li key={l.href + l.label}>
          {l.external ? (
            <a href={l.href} className="transition-colors hover:text-[var(--color-ink)]">
              {l.label}
            </a>
          ) : (
            <Link href={l.href} className="transition-colors hover:text-[var(--color-ink)]">
              {l.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[0.8rem] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
    {children}
  </h3>
);

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-[var(--color-footer)] text-[var(--color-ink)]">
      <div className="container-wide grid gap-12 py-16 lg:grid-cols-[1.4fr_repeat(3,1fr)_1.1fr] lg:gap-10 lg:py-20">
        {/* Brand */}
        <div className="max-w-sm">
          <p className="font-display text-2xl uppercase tracking-[0.16em] text-[var(--color-ink)]">
            Velor<span className="text-[var(--color-accent)]">&nbsp;House</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-soft)]">
            Timeless style for every generation — thoughtfully designed, beautifully made.
          </p>
          <Link
            href="/#the-list"
            className="mt-5 inline-block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink)] link-underline"
          >
            Join the list
          </Link>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.title}>
            <Heading>{col.title}</Heading>
            <ColumnLinks links={col.links} />
          </div>
        ))}

        {/* Get in touch */}
        <div>
          <Heading>Get in Touch</Heading>
          <ul className="mt-5 space-y-4 text-sm text-[var(--color-ink-soft)]">
            <li className="flex items-start gap-2.5">
              <IconWhatsApp />
              <a
                href={SITE.whatsappUrl}
                className="underline decoration-1 underline-offset-2 transition-colors hover:text-[var(--color-ink)]"
              >
                {SITE.phoneDisplay}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <IconPhone />
              <a
                href={`tel:${SITE.phoneE164}`}
                className="transition-colors hover:text-[var(--color-ink)]"
              >
                {SITE.phoneDisplay}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <IconMail />
              <a
                href={`mailto:${SITE.email}`}
                className="break-all transition-colors hover:text-[var(--color-ink)]"
              >
                {SITE.email}
              </a>
            </li>
          </ul>

          <div className="mt-6 flex gap-3 text-[var(--color-ink)]">
            {/* Instagram + WhatsApp are the live channels; add real Facebook / X URLs when available. */}
            <Social label="Instagram" href="https://instagram.com"><IconInstagram /></Social>
            <Social label="Facebook" href="https://facebook.com"><IconFacebook /></Social>
            <Social label="X" href="https://x.com"><IconX /></Social>
            <Social label="WhatsApp" href={SITE.whatsappUrl}><IconWhatsApp /></Social>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide py-5 text-center text-xs text-[var(--color-ink-mute)] sm:text-left">
          © {new Date().getFullYear()} {SITE.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function Social({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-ink)]/25 text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
    >
      {children}
    </a>
  );
}

/* ---------------------------------------------------------------- icons */

const svg = 'h-[1.05rem] w-[1.05rem] shrink-0';

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l1.4-4A8 8 0 1 1 8 18.6L4 20z" />
      <path d="M9 9c0 4 2 6 6 6M9 9c0-1 .5-1.6 1-1.6M15 15c1 0 1.6-.5 1.6-1" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5L19 16l4 1.5V21a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-1z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 8.5V6.7c0-.8.5-1.2 1.2-1.2H17V2.6h-2.6c-2.6 0-3.8 1.7-3.8 4v1.9H8.5v3h2.1V22h3.4v-10.5H16l.6-3H14z" />
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}
