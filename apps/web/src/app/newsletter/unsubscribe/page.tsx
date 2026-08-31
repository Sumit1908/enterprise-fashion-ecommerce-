'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SITE } from '@/lib/site';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<Shell>Loading…</Shell>}>
      <Inner />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-wide max-w-md py-20 text-center">
      <p className="eyebrow">Newsletter</p>
      <div className="mt-4 text-sm text-[var(--color-ink-soft)]">{children}</div>
      <Link href="/" className="link-underline mt-8 inline-block text-xs font-semibold uppercase tracking-[0.14em]">
        Back to Velor House
      </Link>
    </div>
  );
}

function Inner() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'busy' | 'done' | 'error'>('busy');

  useEffect(() => {
    if (!email || !token) {
      setState('error');
      return;
    }
    fetch(`${API_BASE}/api/v1/newsletter/unsubscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then((r) => setState(r.ok ? 'done' : 'error'))
      .catch(() => setState('error'));
  }, [email, token]);

  return (
    <Shell>
      {state === 'busy' && 'Updating your preferences…'}
      {state === 'done' && (
        <>
          <p className="font-display text-xl text-[var(--color-ink)]">You&apos;ve been unsubscribed.</p>
          <p className="mt-2">You won&apos;t receive any more marketing emails from us.</p>
        </>
      )}
      {state === 'error' && (
        <>This unsubscribe link looks invalid or has expired. Email {SITE.email} and we&apos;ll sort it out.</>
      )}
    </Shell>
  );
}
