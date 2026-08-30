'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { storefront, type WishlistProduct } from './storefront';
import { readLocalWishlist, writeLocalWishlist } from './wishlist-store';
import { useAuth } from './auth-context';

interface WishlistState {
  /** Product slugs currently saved (works for guests and signed-in users). */
  slugs: string[];
  /** Full product records — populated for signed-in users. */
  products: WishlistProduct[];
  count: number;
  ready: boolean;
  synced: boolean;
  has: (slug: string) => boolean;
  toggle: (slug: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistState | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [slugs, setSlugs] = useState<string[]>([]);
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (user) {
      try {
        const res = await storefront.getWishlist();
        setProducts(res.items.map((i) => i.product));
        setSlugs(res.items.map((i) => i.product.slug));
      } catch {
        /* keep previous */
      }
    } else {
      setProducts([]);
      setSlugs(readLocalWishlist());
    }
    setReady(true);
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, refresh]);

  useEffect(() => {
    const onLocal = () => {
      if (!user) setSlugs(readLocalWishlist());
    };
    window.addEventListener('sj:wishlist', onLocal);
    window.addEventListener('storage', onLocal);
    return () => {
      window.removeEventListener('sj:wishlist', onLocal);
      window.removeEventListener('storage', onLocal);
    };
  }, [user]);

  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  const toggle = useCallback(
    async (slug: string) => {
      if (user) {
        if (slugs.includes(slug)) {
          const target = products.find((p) => p.slug === slug);
          if (target) {
            const res = await storefront.removeWishlist(target.id);
            setProducts(res.items.map((i) => i.product));
            setSlugs(res.items.map((i) => i.product.slug));
          }
        } else {
          const res = await storefront.addWishlist(slug);
          setProducts(res.items.map((i) => i.product));
          setSlugs(res.items.map((i) => i.product.slug));
        }
      } else {
        const next = slugs.includes(slug)
          ? slugs.filter((s) => s !== slug)
          : [slug, ...slugs];
        writeLocalWishlist(next);
        setSlugs(next);
      }
    },
    [user, slugs, products],
  );

  const remove = useCallback(
    async (productId: string) => {
      if (user) {
        const res = await storefront.removeWishlist(productId);
        setProducts(res.items.map((i) => i.product));
        setSlugs(res.items.map((i) => i.product.slug));
      } else {
        const target = products.find((p) => p.id === productId);
        if (target) {
          const next = slugs.filter((s) => s !== target.slug);
          writeLocalWishlist(next);
          setSlugs(next);
        }
      }
    },
    [user, products, slugs],
  );

  const value = useMemo<WishlistState>(
    () => ({
      slugs,
      products,
      count: slugs.length,
      ready,
      synced: Boolean(user),
      has,
      toggle,
      remove,
      refresh,
    }),
    [slugs, products, ready, user, has, toggle, remove, refresh],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within <WishlistProvider>');
  return ctx;
}
