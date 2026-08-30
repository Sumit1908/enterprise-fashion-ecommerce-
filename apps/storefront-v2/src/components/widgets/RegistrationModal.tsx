'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useStore } from '@/lib/store';

const KEY = 'sj2_reg_modal_dismissed';
const DELAY_MS = 9000;

export function RegistrationModal() {
  const { showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === '1';
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => dialogRef.current?.focus(), 40);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    close();
    showToast('Thanks! Your birthday offer is on its way.');
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reg-title"
    >
      <div className="absolute inset-0 bg-black/55" onClick={close} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="animate-fade-up relative grid w-full max-w-[1000px] overflow-hidden rounded-2xl bg-white shadow-2xl outline-none md:grid-cols-2"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[var(--color-ink)] hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* left promo */}
        <div className="flex flex-col justify-center gap-4 bg-gradient-to-br from-[var(--color-red)] to-[var(--color-red-dark)] px-8 py-10 text-white md:px-10 md:py-14">
          <Logo light asLink={false} />
          <h3 className="text-2xl font-black uppercase leading-tight md:text-3xl">
            Welcome! Register to avail the best deals
          </h3>
          <p className="text-sm text-white/85">
            Members get early access to drops, birthday offers and members-only pricing.
          </p>
        </div>

        {/* right form */}
        <div className="px-7 py-8 md:px-10 md:py-12">
          <h2 id="reg-title" className="text-lg font-black uppercase leading-tight">
            Complete your profile to{' '}
            <span className="text-[var(--color-red)]">unlock</span> birthday offers
          </h2>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="reg-mobile" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Mobile number*
              </label>
              <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] focus-within:border-[var(--color-ink)]">
                <span className="grid place-items-center bg-[var(--color-gray-50)] px-3 text-[13px] text-[var(--color-text-muted)]">
                  +91
                </span>
                <input
                  id="reg-mobile"
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  placeholder="Enter mobile number"
                  className="w-full px-3 py-2.5 text-[14px] outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Email*
              </label>
              <input
                id="reg-email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--color-ink)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-dob" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Birthday
                </label>
                <input
                  id="reg-dob"
                  type="text"
                  placeholder="DD-MM-YYYY"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--color-ink)]"
                />
              </div>
              <div>
                <label htmlFor="reg-gender" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Gender
                </label>
                <select
                  id="reg-gender"
                  defaultValue=""
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[var(--color-ink)]"
                >
                  <option value="" disabled>
                    Select
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="na">Prefer not to say</option>
                </select>
              </div>
            </div>

            <label className="flex items-start gap-2 text-[12px] leading-snug text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-red)]"
              />
              <span>
                I accept that I have read &amp; understood Slay Jeans&rsquo;s{' '}
                <a href="/policy/privacy" className="underline">Privacy Policy</a> and{' '}
                <a href="/policy/terms" className="underline">T&amp;Cs</a>.
              </span>
            </label>

            <button type="submit" className="btn btn-red w-full rounded-[12px] py-3 text-[13px] uppercase tracking-[0.12em]">
              Submit
            </button>
            <p className="text-center text-[12px] text-[var(--color-text-muted)]">
              <a href="/account" className="underline">Trouble logging in?</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
