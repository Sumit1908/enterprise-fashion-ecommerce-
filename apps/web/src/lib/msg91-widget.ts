'use client';

/**
 * MSG91 "Secure OTP" widget — client-side integration.
 *
 * The widget script sends and verifies the OTP entirely in the browser and
 * returns a short-lived access token. We drive it headlessly (`exposeMethods`)
 * so the on-screen UI stays 100% Velor House; the token then goes to our API
 * (`POST /auth/otp/widget/verify`) which validates it with MSG91 server-side.
 *
 * The widget id + token auth are public and come from `GET /auth/otp/config`
 * (set once on the API), with NEXT_PUBLIC_* build vars as a fallback. The MSG91
 * authkey never leaves the server. The deprecated verification webhook is unused.
 *
 * If the widget's captcha challenges a visitor, hCaptcha renders into a small
 * container we mount on <body> (`CAPTCHA_ID`); most real users pass invisibly.
 * Any widget failure (bad config, captcha unsolved, timeout) falls back to SMS.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { storefront } from './storefront';

const NEXT_PUBLIC_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? '';
const NEXT_PUBLIC_TOKEN_AUTH = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH ?? '';

const SCRIPT_SRC = 'https://verify.msg91.com/otp-provider.js';
const CAPTCHA_ID = 'msg91-captcha-slot';
// Sending can involve the shopper solving a captcha challenge, so be generous;
// verification is a quick round-trip.
const SEND_TIMEOUT_MS = 45000;
const VERIFY_TIMEOUT_MS = 20000;

type Cb = (data: unknown) => void;
interface Msg91Config {
  widgetId: string;
  tokenAuth: string;
  exposeMethods?: boolean | string;
  captchaRenderId?: string;
  success?: Cb;
  failure?: Cb;
}
declare global {
  interface Window {
    initSendOTP?: (config: Msg91Config) => void;
    sendOtp?: (identifier: string, success: Cb, failure: Cb) => void;
    verifyOtp?: (otp: string | number, success: Cb, failure: Cb) => void;
    retryOtp?: (channel: string | null, success: Cb, failure: Cb) => void;
  }
}

interface ResolvedConfig {
  enabled: boolean;
  widgetId: string;
  tokenAuth: string;
  otpLength: number;
  resendInSec: number | null;
}

const WIDGET_INFO_URL = 'https://control.msg91.com/api/v5/widget/getWidgetProcess';
const okLen = (n: unknown): n is number => typeof n === 'number' && n >= 4 && n <= 8;

/** Ask MSG91 directly for the widget's OTP length — used only if the API couldn't. */
async function fetchWidgetInfo(
  widgetId: string,
  tokenAuth: string,
): Promise<{ otpLength?: number; resendInSec?: number }> {
  try {
    const res = await fetch(`${WIDGET_INFO_URL}?widgetId=${encodeURIComponent(widgetId)}`, {
      headers: { tokenauth: tokenAuth, accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    const j = (await res.json()) as { data?: { otpLength?: number; retryTime?: number }; hasError?: boolean };
    if (!res.ok || j.hasError || !j.data) return {};
    return {
      otpLength: okLen(j.data.otpLength) ? j.data.otpLength : undefined,
      resendInSec: typeof j.data.retryTime === 'number' ? j.data.retryTime : undefined,
    };
  } catch {
    return {};
  }
}

let configPromise: Promise<ResolvedConfig> | null = null;
function resolveConfig(): Promise<ResolvedConfig> {
  if (configPromise) return configPromise;
  configPromise = storefront
    .otpConfig()
    .then(async (c) => {
      const widgetId = c.widgetId || NEXT_PUBLIC_WIDGET_ID;
      const tokenAuth = c.tokenAuth || NEXT_PUBLIC_TOKEN_AUTH;
      const enabled = Boolean(c.widget && widgetId && tokenAuth);

      let otpLength = okLen(c.otpLength) ? c.otpLength : 6;
      let resendInSec = c.widgetResendInSec ?? null;
      // The API couldn't reach MSG91 for the OTP length — confirm it client-side.
      if (enabled && !c.otpLengthKnown) {
        const info = await fetchWidgetInfo(widgetId, tokenAuth);
        if (info.otpLength) otpLength = info.otpLength;
        if (info.resendInSec != null) resendInSec = info.resendInSec;
      }
      return { enabled, widgetId, tokenAuth, otpLength, resendInSec };
    })
    .catch(() => ({ enabled: false, widgetId: '', tokenAuth: '', otpLength: 6, resendInSec: null }));
  return configPromise;
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.initSendOTP) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('widget script failed to load'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/** A place for the captcha to render if the widget ever needs to challenge. */
function ensureCaptchaSlot(): void {
  if (typeof document === 'undefined' || document.getElementById(CAPTCHA_ID)) return;
  const el = document.createElement('div');
  el.id = CAPTCHA_ID;
  el.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647';
  document.body.appendChild(el);
}

/** Long, JWT-ish strings only — never a status message like "OTP verified". */
function extractToken(data: unknown): string | null {
  if (typeof data === 'string') return data.length > 20 ? data : null;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of ['access-token', 'accessToken', 'message', 'token', 'authToken', 'jwt']) {
      const v = o[key];
      if (typeof v === 'string' && v.length > 20) return v;
    }
  }
  return null;
}

/** Wrap a callback-style MSG91 method in a promise that rejects if it stalls. */
function withTimeout<T>(
  executor: (resolve: (v: T) => void, reject: (e: Error) => void) => void,
  ms: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('The OTP service did not respond. Please try again.'));
    }, ms);
    const wrap =
      <U,>(fn: (v: U) => void) =>
      (v: U) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(v);
      };
    executor(wrap(resolve), wrap(reject));
  });
}

function errorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data) return data;
  if (Array.isArray(data)) {
    const first = data.find((x) => typeof x === 'string' && x);
    if (first) return first as string;
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of ['message', 'msg', 'error', 'errorMessage']) {
      if (typeof o[key] === 'string' && o[key]) return o[key] as string;
    }
  }
  return fallback;
}

export interface Msg91Otp {
  /** false once config resolves and the widget is not available — use the SMS flow. */
  enabled: boolean;
  /** true once the API config has been checked (widget or not). */
  resolved: boolean;
  /** true once the widget script has initialised and can send/verify. */
  ready: boolean;
  /** Non-fatal init error (script blocked, bad config). Caller falls back to SMS. */
  initError: string | null;
  /** Digits in the widget's OTP (from MSG91). 6 when the widget isn't in use. */
  otpLength: number;
  /** Seconds before "Resend" is allowed on the widget, if MSG91 specified one. */
  resendInSec: number | null;
  /** Send an OTP. `mobile` = 10 local digits; country code (91) is added here. */
  sendOtp: (mobile: string) => Promise<void>;
  /** Resend the OTP (SMS channel). */
  retryOtp: () => Promise<void>;
  /** Verify the code; resolves with the access token for the server to check. */
  verifyOtp: (code: string) => Promise<string>;
}

export function useMsg91Otp(): Msg91Otp {
  const [enabled, setEnabled] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [otpLength, setOtpLength] = useState(6);
  const [resendInSec, setResendInSec] = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveConfig()
      .then((cfg) => {
        if (cancelled) return;
        setResolved(true);
        setEnabled(cfg.enabled);
        setOtpLength(cfg.otpLength);
        setResendInSec(cfg.resendInSec);
        if (!cfg.enabled) return;
        return loadScript().then(() => {
          if (cancelled) return;
          if (typeof window.initSendOTP !== 'function') {
            throw new Error('widget did not initialise');
          }
          ensureCaptchaSlot();
          window.initSendOTP({
            widgetId: cfg.widgetId,
            tokenAuth: cfg.tokenAuth,
            exposeMethods: true,
            captchaRenderId: CAPTCHA_ID,
            success: (data) => {
              const t = extractToken(data);
              if (t) tokenRef.current = t;
            },
            failure: () => {
              /* per-call failures are handled by the call-site promises */
            },
          });
          setReady(true);
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResolved(true);
          setInitError(err instanceof Error ? err.message : 'widget unavailable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sendOtp = useCallback(async (mobile: string) => {
    if (typeof window.sendOtp !== 'function') throw new Error('OTP service is still loading. Please retry.');
    tokenRef.current = null;
    const identifier = `91${mobile.replace(/\D/g, '').slice(-10)}`;
    await withTimeout<void>((resolve, reject) => {
      window.sendOtp!(
        identifier,
        () => resolve(),
        (e) => reject(new Error(errorMessage(e, 'Could not send the OTP. Please try again.'))),
      );
    }, SEND_TIMEOUT_MS);
  }, []);

  const retryOtp = useCallback(async () => {
    if (typeof window.retryOtp !== 'function') throw new Error('OTP service is still loading. Please retry.');
    await withTimeout<void>((resolve, reject) => {
      window.retryOtp!(
        null,
        () => resolve(),
        (e) => reject(new Error(errorMessage(e, 'Could not resend the OTP. Please try again.'))),
      );
    }, SEND_TIMEOUT_MS);
  }, []);

  const verifyOtp = useCallback(async (code: string) => {
    if (typeof window.verifyOtp !== 'function') throw new Error('OTP service is still loading. Please retry.');
    return withTimeout<string>((resolve, reject) => {
      window.verifyOtp!(
        code.replace(/\D/g, ''),
        (data) => {
          const token = extractToken(data) ?? tokenRef.current;
          if (token) resolve(token);
          else reject(new Error('Verification did not complete. Please try again.'));
        },
        (e) => reject(new Error(errorMessage(e, 'That code is incorrect or expired.'))),
      );
    }, VERIFY_TIMEOUT_MS);
  }, []);

  return useMemo(
    () => ({
      enabled,
      resolved,
      ready,
      initError,
      otpLength,
      resendInSec,
      sendOtp,
      retryOtp,
      verifyOtp,
    }),
    [enabled, resolved, ready, initError, otpLength, resendInSec, sendOtp, retryOtp, verifyOtp],
  );
}
