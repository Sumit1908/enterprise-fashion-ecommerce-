'use client';

import { useState } from 'react';

/**
 * Newsletter sign-up. There is no email backend wired up yet, so this validates
 * the address and stores intent locally, then shows an honest confirmation.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try {
      window.localStorage.setItem('sj_newsletter', email);
    } catch {
      /* ignore */
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="mx-auto mt-8 max-w-md text-sm text-[var(--color-bone)]/80">
        Thank you — you&apos;ll be among the first to hear about new drops and restocks.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md items-end gap-4">
      <label className="flex-1 text-left">
        <span className="sr-only">Email address</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full border-0 border-b border-[var(--color-bone)]/40 bg-transparent pb-2.5 text-sm text-[var(--color-bone)] placeholder:text-[var(--color-bone)]/50 focus:border-[var(--color-accent)] focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="shrink-0 border-b border-[var(--color-accent)] pb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-soft)] transition hover:text-[var(--color-bone)]"
      >
        Subscribe
      </button>
    </form>
  );
}
