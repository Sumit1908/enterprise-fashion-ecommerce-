'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

export function Newsletter() {
  const { showToast } = useStore();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setDone(true);
    showToast('You’re on the list — welcome to SLAY JEANS');
  }

  if (done) {
    return (
      <p className="mt-4 max-w-sm text-sm text-[var(--color-text-muted)]">
        Thanks — check your inbox for a welcome note and your first offer.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 max-w-sm">
      <label htmlFor="nl-email" className="sr-only">
        Email address
      </label>
      <input
        id="nl-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="w-full rounded-full border border-[var(--color-border)] bg-white px-5 py-3 text-sm outline-none focus:border-[var(--color-ink)]"
      />
      <button type="submit" className="btn btn-red mt-3 w-full rounded-full py-3 text-[13px] uppercase tracking-[0.12em]">
        Sign Up Now
      </button>
    </form>
  );
}
