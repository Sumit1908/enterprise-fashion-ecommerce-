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
}

export const FITS: Fit[] = [
  { label: 'Slim', query: 'slim', match: ['slim'], blurb: 'Close through the leg' },
  { label: 'Straight', query: 'straight', match: ['straight'], blurb: 'A clean, even line' },
  { label: 'Relaxed', query: 'relaxed', match: ['relaxed', 'mom'], blurb: 'Room to move' },
  { label: 'Wide Leg', query: 'wide', match: ['wide'], blurb: 'Architectural volume' },
  { label: 'Skinny', query: 'skinny', match: ['skinny'], blurb: 'Sculpted and sleek' },
];
