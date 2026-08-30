/**
 * Single source of truth for Slay Jeans business + contact details used across
 * the storefront (footer, contact page, policy pages, structured data).
 *
 * Only details the business owner has provided are here. No GSTIN, PAN, CIN,
 * company registration number, legal entity name or owner name is included —
 * add those here (and to the policy pages) once they are available.
 */
export const SITE = {
  name: 'Slay Jeans',
  tagline: 'Denim, redefined.',
  description:
    'Premium denim and fashion for Men, Women and Kids. New washes, considered fits, limited runs.',

  email: 'slayjeans@gmail.com',
  // Display + tel/wa link forms of the same number.
  phoneDisplay: '+91 93367 91807',
  phoneE164: '+919336791807',
  whatsappUrl: 'https://wa.me/919336791807',

  supportHours: 'Monday to Saturday, 10:00 AM – 7:00 PM IST',

  address: {
    line1: 'Lalganj Ajhara',
    city: 'Pratapgarh',
    state: 'Uttar Pradesh',
    pincode: '230132',
    country: 'India',
  },
  /** "Lalganj Ajhara, Pratapgarh, Uttar Pradesh – 230132, India" */
  get addressInline() {
    const a = this.address;
    return `${a.line1}, ${a.city}, ${a.state} – ${a.pincode}, ${a.country}`;
  },
  /** Lines for a stacked address block. */
  get addressLines() {
    const a = this.address;
    return [this.name, a.line1, `${a.city}, ${a.state} – ${a.pincode}`, a.country];
  },

  currency: 'INR',
  freeShippingThreshold: 999,
  standardShippingFee: 79,
  expressShippingFee: 199,
  codFee: 49,
  returnWindowDays: 7,
} as const;
