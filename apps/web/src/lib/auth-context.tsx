'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { storefront, setAuthToken, getAuthToken, ApiError } from './storefront';
import { readLocalWishlist, clearLocalWishlist } from './wishlist-store';

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  loyaltyPoints: number;
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** After sign-in, fold any guest wishlist saved in this browser into the account. */
async function mergeGuestWishlist() {
  const slugs = readLocalWishlist();
  if (slugs.length === 0) return;
  try {
    await storefront.mergeWishlist(slugs);
    clearLocalWishlist();
  } catch {
    /* non-fatal — keep the local copy */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const loadMe = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser(await storefront.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const finishAuth = useCallback(async (accessToken: string) => {
    setAuthToken(accessToken);
    await mergeGuestWishlist();
    setUser(await storefront.me());
    window.dispatchEvent(new CustomEvent('sj:auth'));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await storefront.login({ email, password });
      await finishAuth(accessToken);
    },
    [finishAuth],
  );

  const register = useCallback(
    async (email: string, password: string, firstName?: string) => {
      const { accessToken } = await storefront.register({ email, password, firstName });
      await finishAuth(accessToken);
    },
    [finishAuth],
  );

  const logout = useCallback(async () => {
    await storefront.logout();
    setAuthToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent('sj:auth'));
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
