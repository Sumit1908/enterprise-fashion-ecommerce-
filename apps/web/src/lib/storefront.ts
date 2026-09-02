'use client';

/**
 * Client-side API helpers for cart / checkout / orders. These run in the browser
 * and carry the guest cart token (persisted in localStorage).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CART_TOKEN_KEY = 'sj_cart_token';
const AUTH_TOKEN_KEY = 'sj_token';

export function getCartToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CART_TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setCartToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(CART_TOKEN_KEY, token);
    else window.localStorage.removeItem(CART_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setAuthToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const cartToken = getCartToken();
  if (cartToken) headers['x-cart-token'] = cartToken;
  const auth = getAuthToken();
  if (auth) headers.authorization = `Bearer ${auth}`;

  const res = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      (data as { message?: string | string[] })?.message ??
      `Request failed (${res.status})`;
    throw new ApiError(Array.isArray(msg) ? msg.join(', ') : msg, res.status, data);
  }
  return data as T;
}

/* ------------------------------------------------------------------ types */

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  sku: string;
  variantLabel: string | null;
  imageUrl: string | null;
  unitPrice: string;
  unitMrp: string;
  quantity: number;
  availableStock: number;
  inStock: boolean;
  lineTotal: string;
}

export interface CartSummary {
  currency: string;
  itemsSubtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  freeShippingThreshold: string | null;
  amountToFreeShipping: string;
}

export interface Cart {
  token: string | null;
  items: CartItem[];
  itemCount: number;
  coupon: { code: string; description: string | null; discount: number } | null;
  summary: CartSummary;
  notices: string[];
}

export interface ShippingOption {
  id: string;
  name: string;
  price: string;
  codFee: string;
  freeAboveAmount: string | null;
  codAvailable: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
}

export interface PaymentMethodOption {
  method: string;
  label: string;
  description: string;
  codAvailable: boolean;
}

export interface PincodeLookup {
  pincode: string;
  city: string;
  district: string;
  state: string;
  area: string | null;
  serviceable: boolean;
  codAvailable: boolean;
  etaMinDays: number;
  etaMaxDays: number;
}

export interface CheckoutSummary {
  cart: Cart;
  guestCheckoutEnabled: boolean;
  minOrderAmount: number;
  shippingOptions: ShippingOption[];
  paymentMethods: PaymentMethodOption[];
  serviceability: {
    pincode: string;
    status?: 'invalid' | 'unserviceable' | 'serviceable';
    serviceable: boolean;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    etaMinDays?: number | null;
    etaMaxDays?: number | null;
    codAvailable: boolean;
  } | null;
}

export interface OrderView {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  placedAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  customerNote: string | null;
  totals: {
    itemsSubtotal: string;
    discountTotal: string;
    shippingTotal: string;
    taxTotal: string;
    grandTotal: string;
  };
  couponCode: string | null;
  shippingAddress: Record<string, string | null>;
  billingAddress: Record<string, string | null>;
  items: {
    id: string;
    productName: string;
    variantLabel: string | null;
    sku: string;
    imageUrl: string | null;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }[];
  payment: { method: string; status: string; gateway: string | null; gatewayOrderId: string | null } | null;
  timeline: { status: string; note: string | null; at: string }[];
  shipments: {
    provider: string;
    awbNumber: string | null;
    status: string;
    trackingUrl: string | null;
    estimatedDelivery: string | null;
    events: { status: string; message: string | null; location: string | null; at: string }[];
  }[];
}

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  mrp: string;
  salePrice: string;
  currency: string;
  ratingAverage: number;
  ratingCount: number;
  isNewArrival?: boolean;
  brand?: { name: string; slug: string } | null;
  media: { url: string; alt: string | null }[];
}

export interface WishlistResponse {
  items: { id: string; addedAt: string; product: WishlistProduct }[];
}

export interface PaymentIntent {
  provider: string;
  requiresClientAction: boolean;
  status: string;
  providerOrderId?: string;
  amount: number;
  currency: string;
  clientConfig?: Record<string, unknown>;
}

/* ---------------------------------------------------------------- endpoints */

export const storefront = {
  getCart: () => request<Cart>('/cart'),
  addToCart: (variantId: string, quantity = 1) =>
    request<Cart>('/cart/items', { method: 'POST', body: JSON.stringify({ variantId, quantity }) }),
  updateCartItem: (itemId: string, quantity: number) =>
    request<Cart>(`/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  removeCartItem: (itemId: string) =>
    request<Cart>(`/cart/items/${itemId}`, { method: 'DELETE' }),
  applyCoupon: (code: string) =>
    request<Cart>('/cart/coupon', { method: 'POST', body: JSON.stringify({ code }) }),
  removeCoupon: () => request<Cart>('/cart/coupon', { method: 'DELETE' }),

  checkoutSummary: (pincode?: string) =>
    request<CheckoutSummary>(`/checkout${pincode ? `?pincode=${encodeURIComponent(pincode)}` : ''}`),
  lookupPincode: (pincode: string) =>
    request<PincodeLookup>(`/geo/pincode/${encodeURIComponent(pincode)}`),
  quote: (input: { pincode?: string; shippingRateId?: string; couponCode?: string; paymentMethod?: string }) =>
    request<{ totals: OrderView['totals'] & { currency: string }; coupon: Cart['coupon']; shippingRateId: string | null; amountToFreeShipping: string }>(
      '/checkout/quote',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  placeOrder: (body: unknown) =>
    request<{ order: OrderView; payment: PaymentIntent }>('/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verifyPayment: (body: {
    orderNumber: string;
    email?: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    signature?: string;
    mockOutcome?: 'success' | 'failure';
  }) => request<{ status: string; orderNumber: string }>('/checkout/verify', { method: 'POST', body: JSON.stringify(body) }),
  retryPayment: (body: { orderNumber: string; email?: string; paymentMethod: string }) =>
    request<{ order: OrderView; payment: PaymentIntent }>('/checkout/retry', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  requestOtp: (body: { phone: string }) =>
    request<{
      phone: string;
      expiresInSec: number;
      resendInSec: number;
      delivered: boolean;
      devCode?: string;
    }>('/auth/otp/request', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body: { phone: string; otp: string; firstName?: string }) =>
    request<{ accessToken: string; isNew: boolean }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () =>
    request<{
      id: string;
      email: string | null;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      loyaltyPoints: number;
    }>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }).catch(() => ({ ok: true })),

  subscribeNewsletter: (body: { email: string; firstName?: string; source?: string }) =>
    request<{ ok: boolean; status: string }>('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getWishlist: () => request<WishlistResponse>('/wishlist'),
  addWishlist: (slug: string) =>
    request<WishlistResponse>('/wishlist', { method: 'POST', body: JSON.stringify({ slug }) }),
  removeWishlist: (productId: string) =>
    request<WishlistResponse>(`/wishlist/${productId}`, { method: 'DELETE' }),
  mergeWishlist: (slugs: string[]) =>
    request<WishlistResponse>('/wishlist/merge', { method: 'POST', body: JSON.stringify({ slugs }) }),

  getOrder: (orderNumber: string, email?: string) =>
    request<OrderView>(`/orders/${orderNumber}${email ? `?email=${encodeURIComponent(email)}` : ''}`),
  myOrders: () =>
    request<
      {
        orderNumber: string;
        status: string;
        paymentStatus: string;
        grandTotal: string;
        currency: string;
        placedAt: string;
        itemCount: number;
        preview: { productName: string; imageUrl: string | null; quantity: number }[];
      }[]
    >('/orders'),
};

export function inr(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}
