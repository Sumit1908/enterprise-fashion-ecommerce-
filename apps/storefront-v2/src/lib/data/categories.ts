import { img, PHOTOS } from '@/lib/images';

export interface CategoryCardData {
  label: string;
  href: string;
  image: string;
}

const P = [
  PHOTOS.model1,
  PHOTOS.model2,
  PHOTOS.model3,
  PHOTOS.model4,
  PHOTOS.model5,
  PHOTOS.model6,
  PHOTOS.model7,
  PHOTOS.model8,
  PHOTOS.model9,
  PHOTOS.model10,
  PHOTOS.model11,
  PHOTOS.model12,
];
const pick = (i: number) => P[i % P.length]!;

export const TOP_WEAR: CategoryCardData[] = [
  'Shirts',
  'T-Shirts',
  'Polos',
  'Shackets',
  'Hoodies',
  'Jackets',
  'Sweatshirts',
].map((label, i) => ({
  label,
  href: `/shop?c=${label.toLowerCase().replace(/\s+/g, '-')}`,
  image: img(pick(i), 700),
}));

export const BOTTOM_WEAR: CategoryCardData[] = ['Jeans', 'Trousers', 'Cargos', 'Shorts', 'Joggers'].map(
  (label, i) => ({
    label,
    href: `/shop?c=${label.toLowerCase()}`,
    image: img([PHOTOS.denimDetail, PHOTOS.model5, PHOTOS.cargoDetail, PHOTOS.model7, PHOTOS.model4][i]!, 700),
  }),
);

export const AESTHETICS: CategoryCardData[] = [
  'Classics',
  'Old Money',
  'Street Wear',
  'Smart Casuals',
  'Print Play',
  'Workwear',
].map((label, i) => ({
  label,
  href: `/shop?aesthetic=${label.toLowerCase().replace(/\s+/g, '-')}`,
  image: img([PHOTOS.model1, PHOTOS.model9, PHOTOS.model4, PHOTOS.model12, PHOTOS.model2, PHOTOS.model6][i]!, 900),
}));

export const OCCASIONS: CategoryCardData[] = [
  'Weekend',
  'Date Night',
  'Travel',
  'Office',
  'Party',
  'Everyday',
].map((label, i) => ({
  label,
  href: `/shop?occasion=${label.toLowerCase().replace(/\s+/g, '-')}`,
  image: img([PHOTOS.model7, PHOTOS.model11, PHOTOS.heroStreet, PHOTOS.model8, PHOTOS.model3, PHOTOS.model5][i]!, 900),
}));

export const SHOP_BY: { label: string; value: string }[] = [
  { label: 'Sale', value: 'sale' },
  { label: 'New Arrivals', value: 'new' },
  { label: 'Classics', value: 'classic' },
  { label: 'Bestsellers', value: 'bestseller' },
];
