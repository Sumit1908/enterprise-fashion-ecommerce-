/**
 * Guest wishlist persistence — a per-browser list of product slugs in
 * localStorage. When the shopper signs in, {@link AuthProvider} folds this into
 * their account via POST /wishlist/merge and clears it.
 */
const KEY = 'sj_wishlist';

export function readLocalWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as string[]).filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function writeLocalWishlist(slugs: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...new Set(slugs)]));
    window.dispatchEvent(new CustomEvent('sj:wishlist'));
  } catch {
    /* ignore */
  }
}

export function clearLocalWishlist(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('sj:wishlist'));
  } catch {
    /* ignore */
  }
}
