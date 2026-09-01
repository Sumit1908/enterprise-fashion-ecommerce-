/**
 * Denim fits surfaced in the "Shop by Fit" navigation and homepage section.
 * Each fit maps to a search term that returns real products from the catalog
 * (matched on product name), so nothing here is fabricated — `match` is used
 * only to choose a representative thumbnail from whatever products exist.
 */
export interface Fit {
  label: string;
  query: string;
  match: string[];
  blurb: string;
  /** Curated fallback image so the tile is never empty when no product name matches. */
  image: string;
}

const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=700&q=80&auto=format&fit=crop`;

export const FITS: Fit[] = [
  { label: 'Slim', query: 'slim', match: ['slim'], blurb: 'Close through the leg', image: IMG('1602293589930-45aad59ba3ab') },
  { label: 'Straight', query: 'straight', match: ['straight'], blurb: 'A clean, even line', image: IMG('1548883354-7622d03aca27') },
  { label: 'Relaxed', query: 'relaxed', match: ['relaxed', 'mom'], blurb: 'Room to move', image: IMG('1541099649105-f69ad21f3246') },
  { label: 'Wide Leg', query: 'wide', match: ['wide'], blurb: 'Architectural volume', image: IMG('1475178626620-a4d074967452') },
  { label: 'Skinny', query: 'skinny', match: ['skinny'], blurb: 'Sculpted and sleek', image: IMG('1584370848010-d7fe6bc767ec') },
];
