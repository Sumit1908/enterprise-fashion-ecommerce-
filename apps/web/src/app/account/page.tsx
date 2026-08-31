'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/storefront';

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading…</div>}>
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const { user, ready, login, register, logout } = useAuth();
  const router = useRouter();
  const nextParam = useSearchParams().get('next');

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, firstName || undefined);
      router.push(nextParam || '/account');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading…</div>
    );
  }

  if (user) {
    return (
      <div className="container-wide max-w-2xl py-14">
        <p className="eyebrow">Account</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">
          {user.firstName ? `Hello, ${user.firstName}` : 'Your account'}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{user.email}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href="/account/orders" className="border border-[var(--color-sand)] bg-[var(--color-paper)] p-5 text-sm hover:border-[var(--color-ink)]">
            <span className="font-semibold">Orders</span>
            <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">Track & review</span>
          </Link>
          <Link href="/wishlist" className="border border-[var(--color-sand)] bg-[var(--color-paper)] p-5 text-sm hover:border-[var(--color-ink)]">
            <span className="font-semibold">Wishlist</span>
            <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">Saved pieces</span>
          </Link>
          <div className="border border-[var(--color-sand)] bg-[var(--color-paper)] p-5 text-sm">
            <span className="font-semibold">{user.loyaltyPoints}</span>
            <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">Loyalty points</span>
          </div>
        </div>

        <button
          onClick={() => {
            void logout();
          }}
          className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="container-wide max-w-md py-14">
      <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Join Velor House'}</p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </h1>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === 'register' && (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1.5 w-full border border-[var(--color-sand)] bg-[var(--color-paper)] px-3.5 py-2.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full border border-[var(--color-sand)] bg-[var(--color-paper)] px-3.5 py-2.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">Password</span>
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full border border-[var(--color-sand)] bg-[var(--color-paper)] px-3.5 py-2.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
          />
          {mode === 'register' && (
            <span className="mt-1 block text-[0.7rem] text-[var(--color-ink-mute)]">At least 8 characters.</span>
          )}
        </label>

        {error && <p className="text-sm text-[var(--color-sale)]">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
        {mode === 'login' ? "New here? " : 'Already have an account? '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          className="link-underline font-semibold text-[var(--color-ink)]"
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>

      <p className="mt-6 text-xs text-[var(--color-ink-mute)]">
        Prefer not to sign in? You can still{' '}
        <Link href="/account/orders" className="link-underline">track an order</Link> with your
        order number and email.
      </p>
    </div>
  );
}
