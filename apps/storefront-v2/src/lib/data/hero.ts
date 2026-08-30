import { img, PHOTOS } from '@/lib/images';

export interface HeroSlide {
  id: string;
  image: string;
  imageMobile: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  cta: string;
  href: string;
  align: 'left' | 'center';
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'denim',
    image: img(PHOTOS.heroDenim, 2000),
    imageMobile: img(PHOTOS.heroDenim, 900),
    eyebrow: 'The Denim Edit',
    headline: 'Denim That Moves With You',
    subheadline: 'Built for everyday',
    cta: 'Shop Now',
    href: '/shop?c=jeans',
    align: 'left',
  },
  {
    id: 'linen',
    image: img(PHOTOS.heroLinen, 2000),
    imageMobile: img(PHOTOS.heroLinen, 900),
    eyebrow: 'Summer Weight',
    headline: 'Pure Linen, Pure Ease',
    subheadline: 'Breathable shirts for warm days',
    cta: 'Shop Linen',
    href: '/shop?c=shirts',
    align: 'left',
  },
  {
    id: 'street',
    image: img(PHOTOS.heroStreet, 2000),
    imageMobile: img(PHOTOS.heroStreet, 900),
    eyebrow: 'New Season',
    headline: 'Off-Duty, On Point',
    subheadline: 'Street-ready layers and fits',
    cta: 'Explore New In',
    href: '/shop?c=bestsellers',
    align: 'left',
  },
];
