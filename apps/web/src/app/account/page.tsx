'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/storefront';
import { useMsg91Otp } from '@/lib/msg91-widget';

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="container-wide py-20 text-center text-sm text-[var(--color-ink-soft)]">Loading…</div>}>
      <AccountInner />
    </Suspense>
  );
}

const SMS_OTP_LENGTH = 6;

/** Keep only digits and cap at 10 (Indian mobile numbers). */
function cleanMobile(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
}

/** +91 98765 43210 */
function prettyPhone(tenDigits: string): string {
  const d = tenDigits.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return `+91 ${tenDigits}`;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

function AccountInner() {
  const { user, ready, requestOtp, verifyOtp, verifyWidgetOtp, logout } = useAuth();
  const widget = useMsg91Otp();
  const router = useRouter();
  const nextParam = useSearchParams().get('next');

  // If the widget is configured but fails at runtime (bad id, captcha unsolved,
  // timeout), we drop to the SMS OTP flow for the rest of the session so sign-in
  // still works. `widgetActive` = the widget is our transport for the NEXT send.
  const [widgetFailed, setWidgetFailed] = useState(false);
  const widgetActive = widget.enabled && !widget.initError && !widgetFailed;
  // What the phone step should promise (the widget's length is 4 or 6).
  const predictedLen = widgetActive ? widget.otpLength : SMS_OTP_LENGTH;

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  // Locked in once an OTP is actually sent, so the code screen never shifts.
  const [transport, setTransport] = useState<'widget' | 'sms'>('sms');
  const [codeLen, setCodeLen] = useState(SMS_OTP_LENGTH);
  const [mobile, setMobile] = useState('');
  const [firstName, setFirstName] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(SMS_OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const boxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const goToOtpStep = useCallback(
    (opts: {
      transport: 'widget' | 'sms';
      length: number;
      isResend: boolean;
      notice: string | null;
      cooldown: number;
    }) => {
      setTransport(opts.transport);
      setCodeLen(opts.length);
      setResendIn(opts.cooldown);
      setStep('otp');
      if (!opts.isResend) setDigits(Array(opts.length).fill(''));
      setNotice(opts.notice);
      setTimeout(() => boxRefs.current[0]?.focus(), 50);
    },
    [],
  );

  const sendViaSms = useCallback(
    async (isResend: boolean) => {
      const res = await requestOtp(`+91${mobile}`);
      goToOtpStep({
        transport: 'sms',
        length: SMS_OTP_LENGTH,
        isResend,
        notice: res.devCode
          ? `Development mode — your code is ${res.devCode}`
          : isResend
            ? 'A new OTP is on its way.'
            : null,
        cooldown: res.resendInSec || 30,
      });
    },
    [mobile, requestOtp, goToOtpStep],
  );

  const sendOtp = useCallback(
    async (isResend: boolean) => {
      setError(null);
      setNotice(null);
      setBusy(true);
      try {
        const tryWidget = isResend ? transport === 'widget' : widgetActive;
        if (tryWidget) {
          try {
            if (isResend) await widget.retryOtp();
            else await widget.sendOtp(mobile);
            goToOtpStep({
              transport: 'widget',
              length: widget.otpLength,
              isResend,
              notice: isResend ? 'A new OTP is on its way.' : null,
              cooldown: widget.resendInSec ?? 30,
            });
            return;
          } catch {
            // Widget failed (bad id, captcha unsolved, timeout) — fall to SMS.
            setWidgetFailed(true);
          }
        }
        await sendViaSms(isResend);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not send the OTP. Please try again.',
        );
      } finally {
        setBusy(false);
      }
    },
    [mobile, transport, widgetActive, widget, sendViaSms, goToOtpStep],
  );

  const preparing = !widget.resolved || (widgetActive && !widget.ready);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    await sendOtp(false);
  }

  const submitOtp = useCallback(
    async (code: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setError(null);
      setBusy(true);
      try {
        const name = firstName.trim() || undefined;
        if (transport === 'widget') {
          const token = await widget.verifyOtp(code);
          await verifyWidgetOtp(`+91${mobile}`, token, name);
        } else {
          await verifyOtp(`+91${mobile}`, code, name);
        }
        router.push(nextParam || '/account');
      } catch (err) {
        setDigits(Array(codeLen).fill(''));
        setTimeout(() => boxRefs.current[0]?.focus(), 50);
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong. Please try again.',
        );
      } finally {
        setBusy(false);
        submittingRef.current = false;
      }
    },
    [mobile, firstName, codeLen, transport, widget, verifyOtp, verifyWidgetOtp, router, nextParam],
  );

  function setDigit(index: number, value: string) {
    const chars = value.replace(/\D/g, '');
    if (!chars) {
      setDigits((prev) => prev.map((d, i) => (i === index ? '' : d)));
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      // support paste of the full code into any box
      const incoming = chars.slice(0, codeLen - index).split('');
      incoming.forEach((c, i) => {
        next[index + i] = c;
      });
      const filledTo = Math.min(index + incoming.length, codeLen - 1);
      setTimeout(() => boxRefs.current[filledTo]?.focus(), 0);
      const joined = next.join('');
      if (joined.length === codeLen && !next.includes('')) {
        setTimeout(() => void submitOtp(joined), 0);
      }
      return next;
    });
  }

  function onOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) boxRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < codeLen - 1) boxRefs.current[index + 1]?.focus();
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
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {user.email ?? (user.phone ? prettyPhone(user.phone) : null)}
        </p>

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

  if (step === 'phone') {
    return (
      <div className="container-wide max-w-md py-14">
        <p className="eyebrow">Welcome to Velor House</p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">Enter your mobile number</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          We&rsquo;ll send you a {predictedLen}-digit code to sign in. No password needed.
        </p>

        <form onSubmit={submitPhone} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">First name (optional)</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="mt-1.5 w-full border border-[var(--color-sand)] bg-[var(--color-paper)] px-3.5 py-2.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-ink-soft)]">Mobile number</span>
            <div className="mt-1.5 flex items-stretch border border-[var(--color-sand)] bg-[var(--color-paper)] focus-within:border-[var(--color-ink)]">
              <span className="flex items-center border-r border-[var(--color-sand)] px-3.5 text-sm text-[var(--color-ink-soft)]">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="98765 43210"
                value={mobile.replace(/(\d{5})(\d+)/, '$1 $2')}
                onChange={(e) => setMobile(cleanMobile(e.target.value))}
                className="w-full bg-transparent px-3.5 py-2.5 text-sm tracking-[0.08em] focus:outline-none"
              />
            </div>
          </label>

          {error && <p className="text-sm text-[var(--color-sale)]">{error}</p>}

          <button
            type="submit"
            disabled={busy || preparing}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {busy ? 'Sending…' : preparing ? 'Preparing…' : 'Send OTP'}
          </button>
        </form>

        <p className="mt-6 text-xs text-[var(--color-ink-mute)]">
          Prefer not to sign in? You can still{' '}
          <Link href="/account/orders" className="link-underline">track an order</Link> with your
          order number and email.
        </p>
      </div>
    );
  }

  return (
    <div className="container-wide max-w-md py-14">
      <p className="eyebrow">Verify your mobile number</p>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl">Enter the OTP</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        We&rsquo;ve sent a {codeLen}-digit OTP to{' '}
        <span className="font-medium text-[var(--color-ink)]">{prettyPhone(mobile)}</span>.{' '}
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError(null);
            setNotice(null);
          }}
          className="link-underline font-semibold text-[var(--color-ink)]"
        >
          Change
        </button>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const code = digits.join('');
          if (code.length === codeLen) void submitOtp(code);
        }}
        className="mt-8 space-y-5"
      >
        <div
          className={`flex gap-2 sm:gap-3 ${codeLen <= 4 ? 'mx-auto max-w-[16rem]' : ''}`}
          role="group"
          aria-label="One-time passcode"
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                boxRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={codeLen}
              value={digit}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onOtpKeyDown(i, e)}
              aria-label={`Digit ${i + 1}`}
              className="h-12 w-full min-w-0 border border-[var(--color-sand)] bg-[var(--color-paper)] text-center font-display text-xl focus:border-[var(--color-ink)] focus:outline-none sm:h-14"
            />
          ))}
        </div>

        {notice && !error && <p className="text-sm text-[var(--color-ink-soft)]">{notice}</p>}
        {error && <p className="text-sm text-[var(--color-sale)]">{error}</p>}

        <button
          type="submit"
          disabled={busy || digits.join('').length !== codeLen}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Verify & Continue'}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
        Didn&rsquo;t receive the OTP?{' '}
        {resendIn > 0 ? (
          <span className="text-[var(--color-ink-mute)]">Resend OTP in {resendIn}s</span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendOtp(true)}
            className="link-underline font-semibold text-[var(--color-ink)] disabled:opacity-50"
          >
            Resend OTP
          </button>
        )}
      </p>
    </div>
  );
}
