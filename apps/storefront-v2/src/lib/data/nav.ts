export interface NavLink {
  label: string;
  href: string;
}

/** Primary header navigation. */
export const MAIN_NAV: NavLink[] = [
  { label: 'Shop All', href: '/shop' },
  { label: 'Shirts', href: '/shop?c=shirts' },
  { label: 'Polo', href: '/shop?c=polo' },
  { label: 'T-Shirts', href: '/shop?c=t-shirts' },
  { label: 'Jeans', href: '/shop?c=jeans' },
  { label: 'Trousers', href: '/shop?c=trousers' },
  { label: 'Sneakers', href: '/shop?c=sneakers' },
  { label: 'Sunglasses', href: '/shop?c=sunglasses' },
  { label: 'Bags', href: '/shop?c=bags' },
];

/** Secondary promo / category pill bar under the header. */
export const CATEGORY_PILLS: (NavLink & { badge?: string; sale?: boolean })[] = [
  { label: 'Sale', href: '/shop?c=sale', sale: true },
  { label: 'Oxford Shirts', href: '/shop?c=oxford-shirts', badge: 'New' },
  { label: 'Bestsellers', href: '/shop?c=bestsellers' },
  { label: 'Limited Drop', href: '/shop?c=limited-drop' },
  { label: 'Topwear', href: '/shop?c=topwear' },
  { label: 'Bottomwear', href: '/shop?c=bottomwear' },
  { label: 'Footwear', href: '/shop?c=footwear' },
  { label: 'Accessories', href: '/shop?c=accessories' },
  { label: 'Rewards', href: '/rewards' },
];
