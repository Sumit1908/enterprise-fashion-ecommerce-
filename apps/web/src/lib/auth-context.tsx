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
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  loyaltyPoints: number;
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  /** Step 1 — send a one-time code to the mobile number (SMS-OTP fallback path). */
  requestOtp: (phone: string) => Promise<{ resendInSec: number; devCode?: string; delivered: boolean }>;
  /** Step 2 — verify the code; signs the customer in (creating the account if new). */
  verifyOtp: (phone: string, otp: string, firstName?: string) => Promise<{ isNew: boolean }>;
  /** MSG91 widget path — hand the widget's access token to the server for sign-in. */
  verifyWidgetOtp: (phone: string, accessToken: string, firstName?: string) => Promise<{ isNew: boolean }>;
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

  const requestOtp = useCallback(async (phone: string) => {
    const res = await storefront.requestOtp({ phone });
    return { resendInSec: res.resendInSec, devCode: res.devCode, delivered: res.delivered };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string, firstName?: string) => {
      const { accessToken, isNew } = await storefront.verifyOtp({ phone, otp, firstName });
      await finishAuth(accessToken);
      return { isNew };
    },
    [finishAuth],
  );

  const verifyWidgetOtp = useCallback(
    async (phone: string, widgetToken: string, firstName?: string) => {
      const { accessToken, isNew } = await storefront.verifyOtpWidget({
        accessToken: widgetToken,
        phone,
        firstName,
      });
      await finishAuth(accessToken);
      return { isNew };
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
    () => ({ user, ready, requestOtp, verifyOtp, verifyWidgetOtp, logout }),
    [user, ready, requestOtp, verifyOtp, verifyWidgetOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
