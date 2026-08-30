'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { PRODUCTS, type Product } from '@/lib/data/products';

export interface CartLine {
  productId: string;
  size: string;
  color: string;
  qty: number;
}

type Overlay = null | 'search' | 'cart' | 'menu';

interface StoreValue {
  /* cart */
  cart: CartLine[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (productId: string, opts?: { size?: string; color?: string; qty?: number }) => void;
  setQty: (line: CartLine, qty: number) => void;
  removeLine: (line: CartLine) => void;
  /* wishlist */
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWished: (productId: string) => boolean;
  /* overlays */
  overlay: Overlay;
  openOverlay: (o: Exclude<Overlay, null>) => void;
  closeOverlay: () => void;
  /* toast */
  toast: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const priceOf = (id: string): number => PRODUCTS.find((p: Product) => p.id === id)?.price ?? 0;
const sameLine = (a: CartLine, b: CartLine) =>
  a.productId === b.productId && a.size === b.size && a.color === b.color;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(load<CartLine[]>('sj2_cart', []));
    setWishlist(load<string[]>('sj2_wishlist', []));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save('sj2_cart', cart);
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated) save('sj2_wishlist', wishlist);
  }, [wishlist, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.body.style.overflow = overlay ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [overlay]);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  const addToCart = useCallback<StoreValue['addToCart']>(
    (productId, opts = {}) => {
      const product = PRODUCTS.find((p) => p.id === productId);
      if (!product) return;
      const line: CartLine = {
        productId,
        size: opts.size ?? product.sizes[Math.floor(product.sizes.length / 2)] ?? product.sizes[0] ?? 'M',
        color: opts.color ?? product.colors[0]?.name ?? 'Default',
        qty: opts.qty ?? 1,
      };
      setCart((prev) => {
        const found = prev.find((l) => sameLine(l, line));
        if (found) return prev.map((l) => (sameLine(l, line) ? { ...l, qty: l.qty + line.qty } : l));
        return [...prev, line];
      });
      setToast(`${product.name} added to bag`);
    },
    [],
  );

  const setLineQty = useCallback<StoreValue['setQty']>((line, qty) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => !sameLine(l, line))
        : prev.map((l) => (sameLine(l, line) ? { ...l, qty } : l)),
    );
  }, []);

  const removeLine = useCallback<StoreValue['removeLine']>((line) => {
    setCart((prev) => prev.filter((l) => !sameLine(l, line)));
  }, []);

  const toggleWishlist = useCallback<StoreValue['toggleWishlist']>(
    (productId) => {
      setWishlist((prev) => {
        const has = prev.includes(productId);
        setToast(has ? 'Removed from wishlist' : 'Saved to wishlist');
        return has ? prev.filter((id) => id !== productId) : [productId, ...prev];
      });
    },
    [],
  );

  const value = useMemo<StoreValue>(() => {
    const cartCount = cart.reduce((n, l) => n + l.qty, 0);
    const cartSubtotal = cart.reduce((s, l) => s + priceOf(l.productId) * l.qty, 0);
    return {
      cart,
      cartCount,
      cartSubtotal,
      addToCart,
      setQty: setLineQty,
      removeLine,
      wishlist,
      toggleWishlist,
      isWished: (id) => wishlist.includes(id),
      overlay,
      openOverlay: (o) => setOverlay(o),
      closeOverlay: () => setOverlay(null),
      toast,
      showToast,
    };
  }, [cart, wishlist, overlay, toast, addToCart, setLineQty, removeLine, toggleWishlist, showToast]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
