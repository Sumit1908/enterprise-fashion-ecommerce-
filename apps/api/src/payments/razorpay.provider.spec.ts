import { createHmac } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The provider reads env at import time via @slay/config.
process.env.RAZORPAY_KEY_ID ??= 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET ??= 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET ??= 'whsec_test';
process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';

let RazorpayProvider: typeof import('./razorpay.provider.js').RazorpayProvider;

beforeAll(async () => {
  ({ RazorpayProvider } = await import('./razorpay.provider.js'));
});

describe('RazorpayProvider.verify (checkout callback signature)', () => {
  const providerOrderId = 'order_ABC123';
  const providerPaymentId = 'pay_XYZ789';
  const goodSig = () =>
    createHmac('sha256', 'rzp_test_secret')
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');
  const mockPaymentLookup = (body: unknown, ok = true) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response);

  afterEach(() => vi.restoreAllMocks());

  it('accepts a signed pair when Razorpay confirms a captured payment of the right amount', async () => {
    const p = new RazorpayProvider();
    mockPaymentLookup({ status: 'captured', order_id: providerOrderId, amount: 10000, currency: 'INR' });
    const res = await p.verify({
      paymentId: 'p1', orderNumber: 'SJ-1', amount: 100,
      providerOrderId, providerPaymentId, signature: goodSig(),
    });
    expect(res.ok).toBe(true);
    expect(res.providerPaymentId).toBe(providerPaymentId);
  });

  it('rejects when Razorpay reports a different amount than the order total', async () => {
    const p = new RazorpayProvider();
    mockPaymentLookup({ status: 'captured', order_id: providerOrderId, amount: 1, currency: 'INR' });
    const res = await p.verify({
      paymentId: 'p1', orderNumber: 'SJ-1', amount: 100,
      providerOrderId, providerPaymentId, signature: goodSig(),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/amount/i);
  });

  it('rejects when the payment is not captured', async () => {
    const p = new RazorpayProvider();
    mockPaymentLookup({ status: 'authorized', order_id: providerOrderId, amount: 10000 });
    const res = await p.verify({
      paymentId: 'p1', orderNumber: 'SJ-1', amount: 100,
      providerOrderId, providerPaymentId, signature: goodSig(),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not captured/i);
  });

  it('rejects when the payment belongs to a different order', async () => {
    const p = new RazorpayProvider();
    mockPaymentLookup({ status: 'captured', order_id: 'order_SOMEONE_ELSE', amount: 10000 });
    const res = await p.verify({
      paymentId: 'p1', orderNumber: 'SJ-1', amount: 100,
      providerOrderId, providerPaymentId, signature: goodSig(),
    });
    expect(res.ok).toBe(false);
  });

  it('falls back to signature-only acceptance if the Razorpay lookup is unavailable', async () => {
    const p = new RazorpayProvider();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const res = await p.verify({
      paymentId: 'p1', orderNumber: 'SJ-1', amount: 100,
      providerOrderId, providerPaymentId, signature: goodSig(),
    });
    expect(res.ok).toBe(true);
  });

  it('rejects a tampered signature', async () => {
    const p = new RazorpayProvider();
    const res = await p.verify({
      paymentId: 'p1',
      orderNumber: 'SJ-1',
      amount: 100,
      providerOrderId: 'order_ABC123',
      providerPaymentId: 'pay_XYZ789',
      signature: 'deadbeef',
    });
    expect(res.ok).toBe(false);
  });

  it('rejects when verification fields are missing', async () => {
    const p = new RazorpayProvider();
    const res = await p.verify({ paymentId: 'p1', orderNumber: 'SJ-1', amount: 100 });
    expect(res.ok).toBe(false);
  });
});

describe('RazorpayProvider.verifyWebhook', () => {
  const sign = (body: string) =>
    createHmac('sha256', 'whsec_test').update(body).digest('hex');

  it('accepts a captured payment with a valid signature and maps it to our payment id', () => {
    const p = new RazorpayProvider();
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', notes: { paymentId: 'our-payment-42' } } } },
    });
    const res = p.verifyWebhook(Buffer.from(body), { 'x-razorpay-signature': sign(body) });
    expect(res.ok).toBe(true);
    expect(res.handled).toBe(true);
    expect(res.outcome).toBe('paid');
    expect(res.paymentId).toBe('our-payment-42');
    expect(res.providerPaymentId).toBe('pay_1');
  });

  it('maps payment.failed to a failed outcome', () => {
    const p = new RazorpayProvider();
    const body = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_2', order_id: 'order_2', notes: { paymentId: 'our-payment-99' } } } },
    });
    const res = p.verifyWebhook(Buffer.from(body), { 'x-razorpay-signature': sign(body) });
    expect(res.outcome).toBe('failed');
    expect(res.paymentId).toBe('our-payment-99');
  });

  it('rejects a body whose signature does not match', () => {
    const p = new RazorpayProvider();
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const res = p.verifyWebhook(Buffer.from(body), { 'x-razorpay-signature': 'wrong' });
    expect(res.ok).toBe(false);
  });

  it('ignores events it does not handle', () => {
    const p = new RazorpayProvider();
    const body = JSON.stringify({ event: 'payment.authorized', payload: { payment: { entity: { id: 'x', order_id: 'y', notes: { paymentId: 'z' } } } } });
    const res = p.verifyWebhook(Buffer.from(body), { 'x-razorpay-signature': sign(body) });
    expect(res.ok).toBe(true);
    expect(res.handled).toBe(false);
  });
});
