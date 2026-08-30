'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { PRODUCTS, formatINR } from '@/lib/data/products';

export function CartDrawer() {
  const { overlay, closeOverlay, cart, cartSubtotal, cartCount, setQty, removeLine } = useStore();
  const open = overlay === 'cart';

  const shipping = cartSubtotal > 0 && cartSubtotal < 1499 ? 99 : 0;
  const total = cartSubtotal + shipping;

  return (
    <div
      className={`fixed inset-0 z-[75] ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeOverlay}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.1em]">
            Your Bag ({cartCount})
          </h2>
          <button
            type="button"
            onClick={closeOverlay}
            aria-label="Close bag"
            className="grid h-9 w-9 place-items-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">Your bag is empty.</p>
            <button type="button" onClick={closeOverlay} className="btn btn-dark rounded-[12px] px-6 py-2.5 text-[13px]">
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {cart.map((line, i) => {
                  const p = PRODUCTS.find((x) => x.id === line.productId);
                  if (!p) return null;
                  return (
                    <li key={i} className="flex gap-3">
                      <Link
                        href={`/product/${p.slug}`}
                        onClick={closeOverlay}
                        className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--color-gray-50)]"
                      >
                        <Image src={p.images[0]} alt={p.name} fill sizes="80px" className="object-cover" />
                      </Link>
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between gap-2">
                          <p className="text-[13px] font-semibold">{p.name}</p>
                          <button
                            type="button"
                            onClick={() => removeLine(line)}
                            aria-label="Remove item"
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-red)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                          {line.color} · Size {line.size}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-[var(--color-border)] text-[13px]">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => setQty(line, line.qty - 1)}
                              className="px-2.5 py-1.5"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center">{line.qty}</span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => setQty(line, line.qty + 1)}
                              className="px-2.5 py-1.5"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-[13px] font-bold">{formatINR(p.price * line.qty)}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-[var(--color-border)] px-5 py-4">
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Subtotal</dt>
                  <dd>{formatINR(cartSubtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Shipping</dt>
                  <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
                </div>
                <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 text-[14px] font-bold">
                  <dt>Total</dt>
                  <dd>{formatINR(total)}</dd>
                </div>
              </dl>
              <Link
                href="/checkout"
                onClick={closeOverlay}
                className="btn btn-red mt-3 w-full rounded-[12px] py-3.5 text-[13px] uppercase tracking-[0.12em]"
              >
                Proceed to Checkout
              </Link>
              <button
                type="button"
                onClick={closeOverlay}
                className="mt-2 w-full text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)] hover:text-[var(--color-ink)]"
              >
                Continue Shopping
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
