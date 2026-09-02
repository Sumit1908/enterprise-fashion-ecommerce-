import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE } from '@/lib/site';

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
  updated?: string;
  blocks: Block[];
}

const UPDATED = '30 August 2026';
const EMAIL = SITE.email;
const PHONE = SITE.phoneDisplay;
const ADDRESS = `${SITE.name}, ${SITE.addressInline}`;

/**
 * Static information + policy pages. Content lives here so the storefront can
 * launch with a complete, consistent set of legal pages; move to the CMS `Page`
 * model later if richer editing is needed.
 *
 * These pages intentionally contain NO GSTIN / PAN / CIN / company registration
 * number / legal entity name / owner name — none was provided. Add them here
 * once available (see also apps/web/src/lib/site.ts).
 */
const PAGES: Record<string, InfoPage> = {
  about: {
    title: 'About Us',
    intro: `${SITE.name} makes premium denim for people who wear their favourites for years, not seasons.`,
    blocks: [
      { p: 'We started with one idea: denim should be considered. The right weight, an honest wash, a fit that holds. Every pair is designed in-house and made in limited runs so we can keep the quality high and the story clear.' },
      { h: 'How we work' },
      { p: 'Small batches. Real feedback. Fits refined over many wear-tests before they ever reach the site. When a run sells out, it is genuinely gone — we would rather cut a new pattern than repeat a mediocre one.' },
      { h: 'Where we are' },
      { p: `${SITE.name} is based in ${SITE.address.city}, ${SITE.address.state}, India. We ship across India.` },
      { p: `Full address: ${ADDRESS}` },
      { h: 'Talk to us' },
      { p: `Email ${EMAIL} or message us on WhatsApp at ${PHONE}. We reply within one business day, ${SITE.supportHours}.` },
    ],
  },

  contact: {
    title: 'Contact Us',
    intro: 'We reply to every message, usually within one business day.',
    blocks: [
      { h: 'Customer support' },
      { list: [
        `Email: ${EMAIL}`,
        `Phone / WhatsApp: ${PHONE}`,
        `Hours: ${SITE.supportHours}`,
      ] },
      { h: 'Business address' },
      { list: [
        SITE.name,
        SITE.address.line1,
        `${SITE.address.city}, ${SITE.address.state} – ${SITE.address.pincode}`,
        SITE.address.country,
      ] },
      { h: 'Order help' },
      { p: 'Have your order number ready (it starts with “SJ-”). You can track any order from the Track Order page using the email you checked out with.' },
      { h: 'Wholesale, press & partnerships' },
      { p: `Write to ${EMAIL} with “Wholesale” or “Press” in the subject line.` },
    ],
  },

  'shipping-policy': {
    title: 'Shipping Policy',
    updated: UPDATED,
    blocks: [
      { h: 'Where we ship' },
      { p: 'We currently ship to addresses within India only.' },
      { h: 'Charges' },
      { list: [
        'Delivery is free on every order — no minimum value.',
        'Cash on Delivery is available across India at no extra charge.',
      ] },
      { h: 'Delivery timelines' },
      { list: [
        'Orders are dispatched within 1–2 business days of confirmation.',
        `Delivery: ${SITE.deliveryMinDays}–${SITE.deliveryMaxDays} business days after dispatch.`,
        'Timelines are estimates and may vary during sales, public holidays or due to courier or weather delays.',
      ] },
      { h: 'Tracking' },
      { p: 'Once your order ships you will receive a tracking link by email. You can also track any order from the Track Order page using your order number and the email used at checkout.' },
      { h: 'Undelivered orders' },
      { p: `If a shipment is returned to us undelivered (wrong address, repeated failed delivery attempts, or refusal to accept), we will contact you at ${EMAIL} or ${PHONE} to arrange re-dispatch or a refund as per our Return & Refund Policy.` },
      { h: 'Questions' },
      { p: `Email ${EMAIL} or message ${PHONE} on WhatsApp.` },
    ],
  },

  'returns-refunds': {
    title: 'Return & Refund Policy',
    updated: UPDATED,
    blocks: [
      { h: 'Return window' },
      { p: `You may request a return within ${SITE.returnWindowDays} days of delivery.` },
      { h: 'Condition of items' },
      { list: [
        'Items must be unworn, unwashed and undamaged, with all original tags attached.',
        'Items must be returned in their original packaging.',
        'For hygiene reasons, innerwear and pierced accessories (if any) are not returnable.',
        'Items marked “Final Sale” on the product page are not returnable.',
      ] },
      { h: 'How to start a return' },
      { list: [
        `Email ${EMAIL} with your order number (SJ-…) and the item(s) you want to return, or message ${PHONE} on WhatsApp.`,
        'We will confirm the return and share pickup or drop-off instructions.',
        'Pack the item securely with tags attached.',
      ] },
      { h: 'Refunds' },
      { list: [
        'Once we receive and inspect the returned item, we will approve or reject the refund and notify you by email.',
        'Approved refunds are processed within 5–7 business days.',
        'For prepaid orders, refunds are issued to the original payment method.',
        'For Cash on Delivery orders, refunds are issued via bank transfer (NEFT/UPI) to details you provide, or as store credit — your choice.',
        'Shipping fees and the COD handling fee are non-refundable unless the return is due to our error.',
      ] },
      { h: 'Exchanges' },
      { p: 'We process exchanges as a return followed by a fresh order. Contact us and we will help you get the right size or colour.' },
      { h: 'Damaged, defective or wrong item' },
      { p: `If your item arrives damaged, defective or is not what you ordered, email ${EMAIL} within 48 hours of delivery with photos and your order number. We will arrange a free replacement or a full refund, including any shipping fees.` },
    ],
  },

  'cancellation-policy': {
    title: 'Cancellation Policy',
    updated: UPDATED,
    blocks: [
      { h: 'Cancelling an order' },
      { list: [
        'You can cancel an order any time before it is dispatched, at no charge.',
        `To cancel, email ${EMAIL} or message ${PHONE} on WhatsApp with your order number (SJ-…) as soon as possible.`,
        'Once an order has been dispatched it cannot be cancelled — you can refuse delivery or start a return once it arrives, as per our Return & Refund Policy.',
      ] },
      { h: 'Refunds for cancelled orders' },
      { list: [
        'Cash on Delivery orders: nothing has been charged, so no refund is needed.',
        'Prepaid orders (when online payment is enabled): the full amount is refunded to the original payment method within 5–7 business days of cancellation.',
      ] },
      { h: 'Cancellations by us' },
      { p: 'We may cancel an order if the item is out of stock, if we cannot verify the delivery address or contact details, if there is a suspected fraudulent or abusive order, or if there is a pricing or listing error. If we cancel your order, we will inform you and refund any amount already paid in full.' },
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
      { p: `Still unsure? Email ${EMAIL} with your measurements and the style you like — we will recommend a size.` },
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
      { p: `If your order has not been dispatched yet, email ${EMAIL} or message ${PHONE} and we will update or cancel it. See our Cancellation Policy for details.` },
      { h: 'How do returns and refunds work?' },
      { p: `You have ${SITE.returnWindowDays} days from delivery to request a return of unworn items with tags. See our Return & Refund Policy.` },
      { h: 'Do you ship outside India?' },
      { p: 'Not yet — India only for now.' },
      { h: 'How do I reach a human?' },
      { p: `Email ${EMAIL} or WhatsApp ${PHONE}, ${SITE.supportHours}.` },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    updated: UPDATED,
    blocks: [
      { p: `This policy explains how ${SITE.name} ("we", "us") collects and uses your information when you use this website.` },
      { h: 'What we collect' },
      { list: [
        'Contact details you give us: name, email address, phone number and delivery address.',
        'Order information: items purchased, order value, payment method and order history.',
        'Account information: if you create an account, your email and a securely hashed password.',
        'Technical and usage data: device, browser, pages viewed and basic analytics, collected to keep the store working and to improve it.',
      ] },
      { h: 'How we use it' },
      { list: [
        'To process, deliver and support your orders.',
        'To respond to your enquiries and provide customer support.',
        'To send order updates, and — only if you opt in — marketing emails. You can unsubscribe from marketing at any time via the link in any email.',
        'To detect and prevent fraud and abuse, and to meet legal obligations.',
      ] },
      { h: 'Who we share it with' },
      { p: 'We never sell your personal data. We share it only with the service providers needed to run the store and fulfil your order — for example our courier partners and, when online payments are enabled, our payment processor — and only for that purpose.' },
      { h: 'Payment data' },
      { p: 'Card, UPI and net-banking details (when online payments are enabled) are handled directly by a PCI-DSS compliant payment processor and are never stored on our servers.' },
      { h: 'Data retention' },
      { p: 'We keep order records for as long as needed for accounting, warranty, tax and legal purposes. Marketing contact details are kept until you unsubscribe.' },
      { h: 'Your choices' },
      { p: `You can ask us to access, correct or delete your personal data, or to stop marketing to you, by emailing ${EMAIL}.` },
      { h: 'Contact' },
      { p: `${SITE.name}, ${SITE.addressInline}. Email: ${EMAIL}.` },
    ],
  },

  terms: {
    title: 'Terms & Conditions',
    updated: UPDATED,
    blocks: [
      { p: `These terms apply to your use of this website and to orders placed with ${SITE.name}. By placing an order you agree to them.` },
      { h: 'Products and pricing' },
      { list: [
        'All prices are in Indian Rupees (INR) and are inclusive of applicable taxes.',
        'Shipping fees and the Cash on Delivery handling fee, where applicable, are shown at checkout before you confirm.',
        'We try to display products and colours accurately, but actual colour may vary slightly with your screen.',
        'We may correct pricing or description errors and cancel affected orders with a full refund of any amount paid.',
      ] },
      { h: 'Orders and payment' },
      { list: [
        'An order is an offer to buy. It is accepted only when we confirm it; until then we may decline or cancel it.',
        'Cash on Delivery is currently the available payment method. Please keep the exact amount ready for the delivery agent.',
        'We may limit or refuse orders that appear fraudulent, abusive, or placed by resellers.',
      ] },
      { h: 'Shipping, returns and cancellation' },
      { p: 'Delivery, returns, refunds and cancellations are governed by our Shipping Policy, Return & Refund Policy and Cancellation Policy, which form part of these terms.' },
      { h: 'Risk and title' },
      { p: 'Title to the goods passes to you on delivery. Risk of loss passes to the carrier on dispatch.' },
      { h: 'Intellectual property' },
      { p: `All content on this site — including the ${SITE.name} name, logo, product photography and copy — belongs to ${SITE.name} and may not be used without permission.` },
      { h: 'Liability' },
      { p: 'To the extent permitted by law, our liability for any order is limited to the amount you paid for that order.' },
      { h: 'Governing law' },
      { p: `These terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of the courts at ${SITE.address.city}, ${SITE.address.state}.` },
      { h: 'Contact' },
      { p: `${SITE.name}, ${SITE.addressInline}. Email: ${EMAIL}. Phone / WhatsApp: ${PHONE}.` },
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
      {page.updated && (
        <p className="mt-2 text-xs text-[var(--color-ink-mute)]">Last updated: {page.updated}</p>
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

      <div className="mt-12 border-t border-[var(--color-sand)] pt-6 text-xs text-[var(--color-ink-soft)]">
        <p className="font-semibold text-[var(--color-ink)]">{SITE.name}</p>
        <p className="mt-1">{SITE.addressInline}</p>
        <p className="mt-1">
          <a href={`mailto:${SITE.email}`} className="link-underline">{SITE.email}</a>
          {' · '}
          <a href={SITE.whatsappUrl} className="link-underline">WhatsApp {SITE.phoneDisplay}</a>
        </p>
      </div>
    </div>
  );
}
