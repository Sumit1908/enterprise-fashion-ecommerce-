import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MessageCircle, Phone } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Newsletter } from '@/components/home/Newsletter';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Quick Shop',
    links: [
      { label: 'Bestsellers', href: '/shop?c=bestsellers' },
      { label: 'New Arrivals', href: '/shop?c=new' },
      { label: 'Trending Now', href: '/shop?c=trending' },
    ],
  },
  {
    title: 'Helpful Links',
    links: [
      { label: 'Refer & Earn', href: '/refer' },
      { label: 'About Us', href: '/about' },
      { label: 'Our Stores', href: '/stores' },
      { label: 'Blogs', href: '/blog' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Track Order', href: '/track' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'Shipping, Return & Exchange Policy', href: '/policy/shipping' },
      { label: 'Privacy Policy', href: '/policy/privacy' },
      { label: 'Press Releases', href: '/press' },
      { label: 'Rewards', href: '/rewards' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-[#e8e8e8] text-[var(--color-ink)] lg:mt-24">
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.6fr_repeat(3,1fr)_1.1fr] lg:gap-8 lg:py-20">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
            Get exclusive updates on the collection launch, personalised communications, and the
            latest news from Slay Jeans.
          </p>
          <Newsletter />
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-[13px] font-bold uppercase tracking-[0.12em]">{col.title}</h3>
            <ul className="mt-4 space-y-2.5 text-[13px] text-[var(--color-text-muted)]">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="hover:text-[var(--color-ink)]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.12em]">Get In Touch</h3>
          <ul className="mt-4 space-y-3 text-[13px] text-[var(--color-text-muted)]">
            <li className="flex items-center gap-2.5">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <a href="https://wa.me/910000000000" className="hover:text-[var(--color-ink)]">
                +91 XXXXX XXXXX
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0" />
              <a href="tel:+910000000000" className="hover:text-[var(--color-ink)]">
                +91 XXXXX XXXXX
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0" />
              <a href="mailto:support@slayjeans.com" className="break-all hover:text-[var(--color-ink)]">
                support@slayjeans.com
              </a>
            </li>
          </ul>
          <div className="mt-5 flex gap-2.5">
            {[
              { icon: Instagram, label: 'Instagram', href: 'https://instagram.com' },
              { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com' },
              { icon: Facebook, label: 'Facebook', href: 'https://facebook.com' },
            ].map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-ink)]/25 text-[var(--color-ink)] transition hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
              >
                <Icon className="h-[15px] w-[15px]" />
              </a>
            ))}
            <a
              href="https://x.com"
              aria-label="X"
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-ink)]/25 text-[13px] font-bold transition hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
            >
              𝕏
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-black/10">
        <p className="container-page py-5 text-center text-[12px] text-[var(--color-text-muted)]">
          © {new Date().getFullYear()} Slay Jeans. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
