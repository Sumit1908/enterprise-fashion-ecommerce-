/**
 * Business + contact details for outbound communication (order emails, etc.).
 * Mirrors apps/web/src/lib/site.ts — keep the two in sync. No GSTIN / PAN / CIN /
 * legal entity name is included because none was provided. Brand: Velor House.
 */
export const BRAND = {
  name: 'Velor House',
  email: 'velorhouse@gmail.com',
  phoneDisplay: '+91 93367 91807',
  whatsappUrl: 'https://wa.me/919336791807',
  addressInline: 'Lalganj Ajhara, Pratapgarh, Uttar Pradesh – 230132, India',
  supportHours: 'Monday to Saturday, 10:00 AM – 7:00 PM IST',
} as const;
