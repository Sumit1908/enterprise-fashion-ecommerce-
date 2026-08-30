/**
 * Placeholder editorial photography (Unsplash). Swap these IDs for real
 * SLAY JEANS campaign / product photography when available — every image in the
 * mock data references this helper so it's a one-file change.
 *
 * All IDs below are verified men's-fashion / denim / editorial frames.
 */
export function img(id: string, w = 1200): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`;
}

export const PHOTOS = {
  heroLinen: '1516257984-b1b4d707412e',
  heroDenim: '1490578474895-699cd4e2cf59',
  heroStreet: '1520975954732-35dd22299614',
  campaignDenim: '1542272604-787c3835535d',
  campaignDenimAlt: '1604176354204-9268737828e4',
  appPromo: '1487222477894-8943e31ef7b2',
  model1: '1507003211169-0a1dd7228f2d',
  model2: '1503341504253-dff4815485f1',
  model3: '1594938328870-9623159c8c99',
  model4: '1516826957135-700dedea698c',
  model5: '1473966968600-fa801b869a1a',
  model6: '1495105787522-5334e3ffa0ef',
  model7: '1492447166138-50c3889fccb1',
  model8: '1519085360753-af0119f7cbe7',
  model9: '1500648767791-00dcc994a43e',
  model10: '1521572163474-6864f9cf17ab',
  model11: '1552374196-c4e7ffc6e126',
  model12: '1506794778202-cad84cf45f1d',
  denimDetail: '1602293589930-45aad59ba3ab',
  cargoDetail: '1548883354-7622d03aca27',
  store1: '1567401893414-76b7b1e5a7a5',
  store2: '1516826957135-700dedea698c',
  store3: '1495105787522-5334e3ffa0ef',
} as const;
