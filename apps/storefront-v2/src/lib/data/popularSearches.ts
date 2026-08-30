export interface SearchColumn {
  title: string;
  links: string[];
}

export const POPULAR_SEARCHES: SearchColumn[] = [
  {
    title: 'Shirts',
    links: [
      "Men's Shirts Online",
      'Linen Shirts for Men',
      'Checks Shirts for Men',
      'Flannel Shirts for Men',
      'Striped Shirts for Men',
      'Full Sleeve Shirts',
      'Formal Shirts for Men',
    ],
  },
  {
    title: 'Polos',
    links: [
      'Polo T-Shirts for Men',
      'Full Sleeve Polos',
      'Half Sleeve Polos',
      'Knitted Polo for Men',
    ],
  },
  {
    title: 'T-Shirts',
    links: ['T-Shirts for Men', 'Cotton T-Shirts Online', 'Oversized T-Shirts', 'Plain T-Shirts'],
  },
  {
    title: 'Bottoms',
    links: [
      "Men's Jeans Online",
      'Denim for Men',
      'Trousers for Men',
      'Cargo Pants for Men',
      'Shorts for Men',
    ],
  },
  {
    title: 'Layering',
    links: [
      'Hoodies for Men',
      'Sweatshirts for Men',
      'Jackets for Men',
      'Shackets for Men',
    ],
  },
  {
    title: 'Footwear',
    links: ['Sneakers for Men', "Men's Footwear", 'White Sneakers', 'Casual Shoes for Men'],
  },
  {
    title: 'Accessories',
    links: [
      'Sunglasses for Men',
      'Socks for Men',
      'Bags for Men',
      'Card Holders',
      'Cufflinks for Men',
      "Men's Accessories",
    ],
  },
  {
    title: 'Shop By Style',
    links: [
      'Shop All Menswear',
      'Top Wear for Men',
      'Casual Wear for Men',
      'Gen Z Fashion Men',
      'Summer Collection',
      'Winter Collection',
      'Site Map',
    ],
  },
];

export const TRENDING_SEARCHES = [
  'Oxford Shirt',
  'Relaxed Jeans',
  'Black Denim',
  'Linen Shirt',
  'Cargo Jogger',
  'Court Sneaker',
  'Piqué Polo',
];
