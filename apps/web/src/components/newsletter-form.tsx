'use client';

import { useState } from 'react';
import { storefront, ApiError } from '@/lib/storefront';

export function NewsletterForm({
  source = 'footer',
  variant = 'minimal',
}: {
  source?: string;
  variant?: 'minimal' | 'footer';
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setState('busy');
    setMessage(null);
    try {
      const res = await storefront.subscribeNewsletter({ email, source });
      setState('done');
      setMessage(
        res.status === 'already-subscribed'
          ? "You're already on the list — thank you."
          : "You're in. Look out for new drops and restocks.",
      );
    } catch (err) {
      setState('error');
      setMessage(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts — please try again in a minute.'
          : 'Could not sign you up just now. Please try again.',
      );
    }
  }

  /* ---------------------------------------------------- footer variant */
  if (variant === 'footer') {
    if (state === 'done') {
      return (
        <p className="mt-4 max-w-sm text-sm text-[var(--color-ink-soft)]">{message}</p>
      );
    }
    return (
      <form onSubmit={submit} className="mt-5 max-w-sm">
        <label className="block">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full rounded-full border border-[var(--color-line)] bg-white px-5 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-mute)] focus:border-[var(--color-ink)] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={state === 'busy'}
          className="mt-3 w-full rounded-full bg-[var(--color-cta)] px-6 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {state === 'busy' ? 'Signing up…' : 'Sign up now'}
        </button>
        {state === 'error' && message && (
          <span className="mt-2 block text-xs text-[var(--color-sale)]">{message}</span>
        )}
      </form>
    );
  }

  /* ---------------------------------------------------- minimal variant */
  if (state === 'done') {
    return (
      <p className="mx-auto mt-8 max-w-md text-sm text-[var(--color-bone)]/80">{message}</p>
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
        {state === 'error' && message && (
          <span className="mt-2 block text-xs text-[var(--color-accent-soft)]">{message}</span>
        )}
      </label>
      <button
        type="submit"
        disabled={state === 'busy'}
        className="shrink-0 border-b border-[var(--color-accent)] pb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-soft)] transition hover:text-[var(--color-bone)] disabled:opacity-50"
      >
        {state === 'busy' ? 'Signing up…' : 'Subscribe'}
      </button>
    </form>
  );
}
