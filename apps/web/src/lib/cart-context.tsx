'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { storefront, setCartToken, ApiError, type Cart } from './storefront';

interface CartState {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  itemCount: number;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback((next: Cart) => {
    setCart(next);
    setCartToken(next.token);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<Cart>) => {
      setError(null);
      try {
        commit(await fn());
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Something went wrong');
        throw e;
      }
    },
    [commit],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      commit(await storefront.getCart());
    } catch {
      /* empty cart / network — leave as is */
    } finally {
      setLoading(false);
    }
  }, [commit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CartState>(
    () => ({
      cart,
      loading,
      error,
      itemCount: cart?.itemCount ?? 0,
      addItem: (variantId, quantity = 1) => run(() => storefront.addToCart(variantId, quantity)),
      updateItem: (itemId, quantity) => run(() => storefront.updateCartItem(itemId, quantity)),
      removeItem: (itemId) => run(() => storefront.removeCartItem(itemId)),
      applyCoupon: (code) => run(() => storefront.applyCoupon(code)),
      removeCoupon: () => run(() => storefront.removeCoupon()),
      refresh,
    }),
    [cart, loading, error, run, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
