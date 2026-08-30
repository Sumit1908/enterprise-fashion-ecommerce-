import { img, PHOTOS } from '@/lib/images';

export interface ColorOption {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  colors: ColorOption[];
  images: [string, string];
  tags: ('bestseller' | 'new' | 'classic' | 'sale' | 'limited')[];
  sizes: string[];
  description: string;
  fabric: string;
}

const SIZES_TOP = ['S', 'M', 'L', 'XL', 'XXL'];
const SIZES_BOTTOM = ['28', '30', '32', '34', '36', '38'];

function pct(mrp: number, price: number) {
  return Math.round(((mrp - price) / mrp) * 100);
}

const base: Omit<Product, 'images'>[] = [
  {
    id: 'p1',
    slug: 'slay-denim-overshirt-indigo',
    name: 'SLAY Denim Overshirt',
    category: 'shirts',
    price: 2999,
    mrp: 4499,
    rating: 4.6,
    ratingCount: 214,
    colors: [
      { name: 'Indigo', hex: '#2f4f7a' },
      { name: 'Washed Black', hex: '#2b2b2b' },
      { name: 'Ecru', hex: '#e6ddca' },
    ],
    tags: ['bestseller', 'new'],
    sizes: SIZES_TOP,
    description:
      'A structured overshirt in mid-weight denim. Wear it open as a layer or buttoned as a shirt — a true do-everything piece.',
    fabric: '100% Cotton denim, 9 oz. Machine wash cold, tumble dry low.',
  },
  {
    id: 'p2',
    slug: 'slay-relaxed-blue-jeans',
    name: 'SLAY Relaxed Blue Jeans',
    category: 'jeans',
    price: 2499,
    mrp: 3999,
    rating: 4.5,
    ratingCount: 341,
    colors: [
      { name: 'Mid Blue', hex: '#4a6b93' },
      { name: 'Stone', hex: '#9aa6b0' },
    ],
    tags: ['bestseller', 'classic'],
    sizes: SIZES_BOTTOM,
    description:
      'A relaxed straight leg with a touch of stretch. Sits at the natural waist and breaks cleanly over the shoe.',
    fabric: '98% Cotton, 2% Elastane. Garment washed for a lived-in softness.',
  },
  {
    id: 'p3',
    slug: 'slay-classic-black-denim',
    name: 'SLAY Classic Black Denim',
    category: 'jeans',
    price: 2499,
    mrp: 3499,
    rating: 4.7,
    ratingCount: 502,
    colors: [
      { name: 'Jet Black', hex: '#141414' },
      { name: 'Faded Black', hex: '#3a3a3a' },
    ],
    tags: ['bestseller', 'classic'],
    sizes: SIZES_BOTTOM,
    description:
      'A true, non-fade black in a slim-straight leg. The one pair that goes with everything, morning to midnight.',
    fabric: '99% Cotton, 1% Elastane power denim. Colour-locked black.',
  },
  {
    id: 'p4',
    slug: 'slay-straight-fit-jeans-raw',
    name: 'SLAY Straight Fit Jeans',
    category: 'jeans',
    price: 2999,
    mrp: 4299,
    rating: 4.4,
    ratingCount: 128,
    colors: [
      { name: 'Raw Indigo', hex: '#243b5e' },
      { name: 'Mid Wash', hex: '#5b7ba3' },
    ],
    tags: ['new', 'limited'],
    sizes: SIZES_BOTTOM,
    description:
      'Rigid raw denim with a clean straight leg. Left un-washed so the indigo breaks in around the knees over time.',
    fabric: '100% Cotton, 13.5 oz. Expect ~1" shrink on first wash.',
  },
  {
    id: 'p5',
    slug: 'slay-premium-oxford-shirt-white',
    name: 'SLAY Premium Oxford Shirt',
    category: 'shirts',
    price: 1999,
    mrp: 2799,
    rating: 4.6,
    ratingCount: 389,
    colors: [
      { name: 'White', hex: '#f4f4f2' },
      { name: 'Sky', hex: '#bcd4e6' },
      { name: 'Pink', hex: '#efc9cf' },
    ],
    tags: ['bestseller', 'classic'],
    sizes: SIZES_TOP,
    description:
      'A refined button-down in soft-washed oxford cotton. Structured collar, tailored-not-tight fit.',
    fabric: '100% Cotton oxford, 120 gsm. Easy-iron finish.',
  },
  {
    id: 'p6',
    slug: 'slay-heavyweight-tee-black',
    name: 'SLAY Heavyweight Tee',
    category: 't-shirts',
    price: 1299,
    mrp: 1799,
    rating: 4.5,
    ratingCount: 610,
    colors: [
      { name: 'Black', hex: '#161616' },
      { name: 'Off White', hex: '#efece4' },
      { name: 'Olive', hex: '#5c5f43' },
    ],
    tags: ['bestseller'],
    sizes: SIZES_TOP,
    description: 'A dense 240 gsm cotton tee that holds its shape. Boxy, modern cut with a ribbed collar.',
    fabric: '100% Combed cotton, 240 gsm. Bio-washed.',
  },
  {
    id: 'p7',
    slug: 'slay-pique-polo-navy',
    name: 'SLAY Piqué Polo',
    category: 'polo',
    price: 1699,
    mrp: 2399,
    rating: 4.4,
    ratingCount: 176,
    colors: [
      { name: 'Navy', hex: '#1f2f4d' },
      { name: 'White', hex: '#f2f2f0' },
      { name: 'Maroon', hex: '#6a2230' },
    ],
    tags: ['new', 'classic'],
    sizes: SIZES_TOP,
    description: 'Classic piqué polo with a two-button placket and tipped collar. Smart enough for the office.',
    fabric: '100% Cotton piqué, 200 gsm.',
  },
  {
    id: 'p8',
    slug: 'slay-tapered-chino-trouser-stone',
    name: 'SLAY Tapered Chino Trouser',
    category: 'trousers',
    price: 2199,
    mrp: 3199,
    rating: 4.3,
    ratingCount: 92,
    colors: [
      { name: 'Stone', hex: '#c8bda6' },
      { name: 'Charcoal', hex: '#3a3d42' },
      { name: 'Olive', hex: '#59604a' },
    ],
    tags: ['classic'],
    sizes: SIZES_BOTTOM,
    description: 'A slim-tapered chino in brushed cotton twill. Clean lines, a slight taper, zero fuss.',
    fabric: '97% Cotton, 3% Elastane twill.',
  },
  {
    id: 'p9',
    slug: 'slay-linen-blend-shirt-sand',
    name: 'SLAY Linen-Blend Shirt',
    category: 'shirts',
    price: 1899,
    mrp: 2699,
    rating: 4.5,
    ratingCount: 233,
    colors: [
      { name: 'Sand', hex: '#d9cbb2' },
      { name: 'Sky', hex: '#bdd3e2' },
      { name: 'White', hex: '#f3f2ee' },
    ],
    tags: ['new', 'bestseller'],
    sizes: SIZES_TOP,
    description: 'A breathable linen-cotton shirt with a relaxed camp collar. Made for heat.',
    fabric: '55% Linen, 45% Cotton.',
  },
  {
    id: 'p10',
    slug: 'slay-cargo-jogger-black',
    name: 'SLAY Cargo Jogger',
    category: 'trousers',
    price: 2299,
    mrp: 3299,
    rating: 4.4,
    ratingCount: 141,
    colors: [
      { name: 'Black', hex: '#171717' },
      { name: 'Olive', hex: '#565b45' },
    ],
    tags: ['new', 'limited'],
    sizes: SIZES_BOTTOM,
    description: 'A tapered cargo jogger with bellowed pockets and a ribbed hem. Street-ready, travel-friendly.',
    fabric: '100% Cotton ripstop.',
  },
  {
    id: 'p11',
    slug: 'slay-court-sneaker-white',
    name: 'SLAY Court Sneaker',
    category: 'sneakers',
    price: 3499,
    mrp: 4999,
    rating: 4.6,
    ratingCount: 88,
    colors: [
      { name: 'White', hex: '#f0f0ee' },
      { name: 'Black', hex: '#191919' },
    ],
    tags: ['bestseller', 'new'],
    sizes: ['6', '7', '8', '9', '10', '11'],
    description: 'A minimal leather court sneaker on a slim cupsole. Everyday, everywhere.',
    fabric: 'Full-grain leather upper, rubber cupsole.',
  },
  {
    id: 'p12',
    slug: 'slay-overshirt-shacket-brown',
    name: 'SLAY Corduroy Shacket',
    category: 'shirts',
    price: 3299,
    mrp: 4799,
    rating: 4.5,
    ratingCount: 64,
    colors: [
      { name: 'Brown', hex: '#6b4a32' },
      { name: 'Navy', hex: '#243049' },
    ],
    tags: ['new', 'limited'],
    sizes: SIZES_TOP,
    description: 'A mid-weight corduroy shacket — the layer for shoulder season. Chest pockets, corozo buttons.',
    fabric: '100% Cotton 8-wale corduroy.',
  },
];

/** Primary / secondary image per product, hand-picked so each fits its category. */
const PRODUCT_IMAGES: [string, string][] = [
  [PHOTOS.model6, PHOTOS.model1], // p1  denim overshirt
  [PHOTOS.denimDetail, PHOTOS.model5], // p2  relaxed blue jeans
  [PHOTOS.campaignDenim, PHOTOS.model2], // p3  classic black denim
  [PHOTOS.campaignDenimAlt, PHOTOS.model7], // p4  straight fit raw
  [PHOTOS.model1, PHOTOS.model10], // p5  oxford shirt
  [PHOTOS.model2, PHOTOS.model4], // p6  heavyweight tee
  [PHOTOS.model3, PHOTOS.model9], // p7  piqué polo
  [PHOTOS.model5, PHOTOS.cargoDetail], // p8  tapered chino
  [PHOTOS.model11, PHOTOS.model12], // p9  linen-blend shirt
  [PHOTOS.cargoDetail, PHOTOS.model4], // p10 cargo jogger
  [PHOTOS.model12, PHOTOS.model8], // p11 court sneaker
  [PHOTOS.model12, PHOTOS.model6], // p12 corduroy shacket
];

export const PRODUCTS: Product[] = base.map((p, i) => {
  const pair = PRODUCT_IMAGES[i % PRODUCT_IMAGES.length]!;
  return { ...p, images: [img(pair[0], 900), img(pair[1], 900)] as [string, string] };
});

export function discountPct(p: Pick<Product, 'mrp' | 'price'>) {
  return pct(p.mrp, p.price);
}

export function formatINR(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function productsByTag(tag: Product['tags'][number]) {
  return PRODUCTS.filter((p) => p.tags.includes(tag));
}

export function getProduct(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}
