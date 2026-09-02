import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
process.env.SMS_PROVIDER = 'msg91';
process.env.MSG91_AUTH_KEY = 'test-authkey';

let SmsService: typeof import('./sms.service.js').SmsService;
let env: Record<string, unknown>;

beforeAll(async () => {
  ({ SmsService } = await import('./sms.service.js'));
  const { loadEnv } = await import('@slay/config');
  env = loadEnv() as unknown as Record<string, unknown>;
});

const okJson = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);

afterEach(() => {
  vi.restoreAllMocks();
  env.MSG91_OTP_TEMPLATE_ID = undefined;
});

describe('SmsService.sendOtp — MSG91', () => {
  it('uses the OTP template API and reports success from the body', async () => {
    env.MSG91_OTP_TEMPLATE_ID = 'tmpl_123';
    const spy = okJson({ type: 'success', request_id: 'r1' });
    const r = await new SmsService().sendOtp('+919812345678', '123456');
    expect(r.delivered).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.provider).toBe('msg91-otp');
    expect(String(spy.mock.calls[0]![0])).toContain('/api/v5/otp');
  });

  it('reports NOT delivered when the OTP API returns an error body (HTTP 200)', async () => {
    env.MSG91_OTP_TEMPLATE_ID = 'tmpl_123';
    okJson({ type: 'error', message: 'template not approved' });
    const r = await new SmsService().sendOtp('+919812345678', '123456');
    expect(r.delivered).toBe(false);
    expect(r.reason).toMatch(/template not approved/);
  });

  it('falls back to the transactional SMS API when no template id is set', async () => {
    const spy = okJson({ type: 'success', message: 'req-1' });
    const r = await new SmsService().sendOtp('+919812345678', '123456');
    expect(r.delivered).toBe(true);
    expect(r.verified).toBe(false); // MSG91 sendsms "success" is not proof of delivery
    expect(r.provider).toBe('msg91-sms');
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toContain('/api/v2/sendsms');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.sms[0].to).toEqual(['919812345678']);
    expect(body.sms[0].message).toContain('123456');
  });

  it('reports NOT delivered when the SMS API returns an error body', async () => {
    okJson({ type: 'error', message: 'sender not registered' });
    const r = await new SmsService().sendOtp('+919812345678', '123456');
    expect(r.delivered).toBe(false);
  });

  it('never throws when the network fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const r = await new SmsService().sendOtp('+919812345678', '123456');
    expect(r.delivered).toBe(false);
    expect(r.provider).toBe('error');
  });
});
