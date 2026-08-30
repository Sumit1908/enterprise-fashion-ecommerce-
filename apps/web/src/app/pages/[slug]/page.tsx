import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

type Block =
  | { h: string }
  | { p: string }
  | { list: string[] };

interface InfoPage {
  title: string;
  intro?: string;
  blocks: Block[];
}

/**
 * Static information pages (policies, help, company). Content lives here so the
 * storefront can launch with a complete footer; move to the CMS `Page` model in
 * a later phase.
 */
const PAGES: Record<string, InfoPage> = {
  about: {
    title: 'Our Story',
    intro:
      'Slay Jeans makes premium denim for people who wear their favourites for years, not seasons.',
    blocks: [
      { p: 'We started with one idea: denim should be considered. The right weight, an honest wash, a fit that holds. Every pair is designed in-house and made in limited runs so we can keep the quality high and the story clear.' },
      { h: 'How we work' },
      { p: 'Small batches. Real feedback. Fits refined over many wear-tests before they ever reach the site. When a run sells out, it is genuinely gone — we would rather cut a new pattern than repeat a mediocre one.' },
      { h: 'Where to reach us' },
      { p: 'Questions, sizing help, or press: help@slayjeans.com.' },
    ],
  },
  contact: {
    title: 'Contact Us',
    intro: 'We reply to every message, usually within one business day.',
    blocks: [
      { h: 'Customer care' },
      { p: 'Email: help@slayjeans.com' },
      { p: 'Phone / WhatsApp: +91 90000 00000 (Mon–Sat, 10am–7pm IST)' },
      { h: 'Order help' },
      { p: 'Have your order number ready (it starts with “SJ-”). You can track any order from the Track Order page using the email you checked out with.' },
      { h: 'Wholesale & press' },
      { p: 'partnerships@slayjeans.com' },
    ],
  },
  'shipping-returns': {
    title: 'Shipping & Returns',
    blocks: [
      { h: 'Shipping' },
      { list: [
        'Free standard shipping on orders over ₹999. Below that, a flat ₹79.',
        'Standard delivery: 3–7 business days. Express: 1–3 business days (₹199).',
        'Cash on Delivery is available across India (₹49 handling fee).',
        'You will get a tracking link by email once your order ships.',
      ] },
      { h: 'Returns & exchanges' },
      { list: [
        'Easy 7-day returns from the date of delivery.',
        'Items must be unworn, unwashed, with tags attached.',
        'Start a return by emailing help@slayjeans.com with your order number.',
        'Refunds are issued to the original payment method within 5–7 business days of us receiving the item. For COD orders, refunds go to bank transfer or store credit.',
      ] },
      { h: 'Damaged or wrong item' },
      { p: 'Email us within 48 hours of delivery with a photo and we will make it right — no return shipping cost to you.' },
    ],
  },
  'size-guide': {
    title: 'Size Guide',
    intro: 'Our jeans are labelled by waist size in inches. Measure a pair that fits you well and compare.',
    blocks: [
      { h: 'Waist (inches)' },
      { list: [
        '28 — 71–73 cm',
        '30 — 76–78 cm',
        '32 — 81–83 cm',
        '34 — 86–89 cm',
        '36 — 91–94 cm',
      ] },
      { h: 'Fit notes' },
      { list: [
        'Slim & Skinny fits: size true to your waist.',
        'Selvedge / raw denim: size true — it relaxes ~1 cm after a few wears; expect ~1" shrink on the first wash.',
        'Relaxed, Wide-leg & Mom fits: size true for a classic look, or size down for a closer fit.',
      ] },
      { p: 'Still unsure? Email help@slayjeans.com with your measurements and the style you like — we will recommend a size.' },
    ],
  },
  faq: {
    title: 'FAQs',
    blocks: [
      { h: 'How do I track my order?' },
      { p: 'Go to Track Order and enter your order number (SJ-…) and the email you used at checkout.' },
      { h: 'What payment methods do you accept?' },
      { p: 'Cash on Delivery is available across India today. Online card / UPI / net-banking payments are coming shortly.' },
      { h: 'Can I change or cancel my order?' },
      { p: 'If your order has not shipped yet, email help@slayjeans.com and we will update or cancel it.' },
      { h: 'Do you ship outside India?' },
      { p: 'Not yet — India only for now.' },
      { h: 'How do returns work?' },
      { p: 'See Shipping & Returns. In short: 7 days, unworn with tags, email us to start.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    blocks: [
      { p: 'We collect only what we need to process your order and improve the store: your name, contact details, delivery address, order history, and basic usage analytics.' },
      { p: 'We never sell your data. We share it only with the partners required to fulfil your order (payment processor, courier) and only for that purpose.' },
      { p: 'You can request a copy of your data or its deletion any time at help@slayjeans.com.' },
      { p: 'Payment details are handled by our PCI-DSS compliant payment processor and are never stored on our servers.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    blocks: [
      { p: 'By placing an order you agree to these terms. Prices are in INR and include applicable taxes. We may correct pricing or description errors and cancel affected orders with a full refund.' },
      { p: 'Title to goods passes to you on delivery. Risk of loss passes to the carrier on dispatch.' },
      { p: 'These terms are governed by the laws of India. Disputes are subject to the courts of Bengaluru, Karnataka.' },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return page ? { title: page.title } : { title: 'Page' };
}

export default async function InfoPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <div className="container-wide max-w-3xl py-12">
      <nav className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--color-ink-soft)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">
          Home
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-ink)]">{page.title}</span>
      </nav>

      <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{page.title}</h1>
      {page.intro && (
        <p className="mt-3 text-base text-[var(--color-ink-soft)]">{page.intro}</p>
      )}

      <div className="mt-8 space-y-4 text-sm leading-relaxed text-[var(--color-ink)]">
        {page.blocks.map((block, i) => {
          if ('h' in block) {
            return (
              <h2 key={i} className="pt-4 text-base font-semibold">
                {block.h}
              </h2>
            );
          }
          if ('list' in block) {
            return (
              <ul key={i} className="list-inside list-disc space-y-1.5 text-[var(--color-ink-soft)]">
                {block.list.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="text-[var(--color-ink-soft)]">
              {block.p}
            </p>
          );
        })}
      </div>
    </div>
  );
}
