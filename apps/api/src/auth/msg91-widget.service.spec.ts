import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
process.env.MSG91_AUTH_KEY ??= 'test-authkey';

let Msg91WidgetService: typeof import('./msg91-widget.service.js').Msg91WidgetService;
let loadEnv: typeof import('@slay/config').loadEnv;

beforeAll(async () => {
  ({ Msg91WidgetService } = await import('./msg91-widget.service.js'));
  ({ loadEnv } = await import('@slay/config'));
});

const mockFetch = (body: unknown, ok = true, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);

afterEach(() => vi.restoreAllMocks());

const TOKEN = 'a'.repeat(120);

describe('Msg91WidgetService.verifyAccessToken', () => {
  it('returns the verified phone that MSG91 reports', async () => {
    mockFetch({ type: 'success', message: '919812345678' });
    const r = await new Msg91WidgetService().verifyAccessToken(TOKEN);
    expect(r).toEqual({ phone: '+919812345678' });
  });

  it('sends the authkey + access-token and never a webhook', async () => {
    const spy = mockFetch({ type: 'success', message: '919812345678' });
    await new Msg91WidgetService().verifyAccessToken(TOKEN);
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toBe('https://control.msg91.com/api/v5/widget/verifyAccessToken');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      authkey: 'test-authkey',
      'access-token': TOKEN,
    });
  });

  it('accepts a success with no parseable number (phone: null)', async () => {
    mockFetch({ type: 'success', message: 'Verification successful' });
    expect(await new Msg91WidgetService().verifyAccessToken(TOKEN)).toEqual({ phone: null });
  });

  it('rejects an invalid / used token', async () => {
    mockFetch({ type: 'error', message: 'access token is invalid or already used' });
    await expect(new Msg91WidgetService().verifyAccessToken(TOKEN)).rejects.toThrow(
      /request a new otp/i,
    );
  });

  it('rejects an HTTP error from MSG91', async () => {
    mockFetch({ message: 'unauthorized' }, false, 401);
    await expect(new Msg91WidgetService().verifyAccessToken(TOKEN)).rejects.toThrow(
      /request a new otp/i,
    );
  });

  it('rejects a malformed token without calling MSG91', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(new Msg91WidgetService().verifyAccessToken('short')).rejects.toThrow(
      /malformed/i,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('surfaces a network failure as service-unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    await expect(new Msg91WidgetService().verifyAccessToken(TOKEN)).rejects.toThrow(
      /could not reach/i,
    );
  });

  it('refuses to run when no authkey is configured', async () => {
    const env = loadEnv() as { MSG91_AUTH_KEY?: string };
    const saved = env.MSG91_AUTH_KEY;
    env.MSG91_AUTH_KEY = undefined;
    try {
      expect(new Msg91WidgetService().configured).toBe(false);
      await expect(new Msg91WidgetService().verifyAccessToken(TOKEN)).rejects.toThrow(
        /not configured/i,
      );
    } finally {
      env.MSG91_AUTH_KEY = saved;
    }
  });

  it('publicConfig only reports widget:true when authkey + widget params are all present', () => {
    const env = loadEnv() as {
      MSG91_AUTH_KEY?: string;
      MSG91_WIDGET_ID?: string;
      MSG91_WIDGET_TOKEN_AUTH?: string;
    };
    const saved = { ...env };
    try {
      env.MSG91_WIDGET_ID = 'w-123';
      env.MSG91_WIDGET_TOKEN_AUTH = undefined;
      expect(new Msg91WidgetService().publicConfig()).toEqual({
        widget: false,
        widgetId: 'w-123',
        tokenAuth: null,
      });

      env.MSG91_WIDGET_TOKEN_AUTH = 't-456';
      expect(new Msg91WidgetService().publicConfig()).toEqual({
        widget: true,
        widgetId: 'w-123',
        tokenAuth: 't-456',
      });
    } finally {
      env.MSG91_WIDGET_ID = saved.MSG91_WIDGET_ID;
      env.MSG91_WIDGET_TOKEN_AUTH = saved.MSG91_WIDGET_TOKEN_AUTH;
    }
  });
});

describe('Msg91WidgetService.widgetInfo', () => {
  const withWidgetEnv = async (fn: () => Promise<void>) => {
    const env = loadEnv() as { MSG91_WIDGET_ID?: string; MSG91_WIDGET_TOKEN_AUTH?: string };
    const saved = { ...env };
    env.MSG91_WIDGET_ID = 'w-abc';
    env.MSG91_WIDGET_TOKEN_AUTH = 't-xyz';
    try {
      await fn();
    } finally {
      env.MSG91_WIDGET_ID = saved.MSG91_WIDGET_ID;
      env.MSG91_WIDGET_TOKEN_AUTH = saved.MSG91_WIDGET_TOKEN_AUTH;
    }
  };

  it('parses otpLength / retryTime / enabled and sends the tokenauth header', async () => {
    await withWidgetEnv(async () => {
      const spy = mockFetch({
        data: { otpLength: 4, retryTime: 10, status: { value: '1' } },
        hasError: false,
      });
      const info = await new Msg91WidgetService().widgetInfo();
      expect(info).toEqual({ enabled: true, otpLength: 4, retryTime: 10 });
      const [url, init] = spy.mock.calls[0]!;
      expect(String(url)).toContain('getWidgetProcess?widgetId=w-abc');
      expect((init as RequestInit).headers).toMatchObject({ tokenauth: 't-xyz' });
    });
  });

  it('reports disabled when MSG91 status is not "1"', async () => {
    await withWidgetEnv(async () => {
      mockFetch({ data: { otpLength: 6, retryTime: 15, status: { value: '2' } }, hasError: false });
      const info = await new Msg91WidgetService().widgetInfo();
      expect(info?.enabled).toBe(false);
    });
  });

  it('returns null (and does not throw) when MSG91 errors', async () => {
    await withWidgetEnv(async () => {
      mockFetch({ hasError: true, errors: 'Invalid Widget Id' });
      expect(await new Msg91WidgetService().widgetInfo()).toBeNull();
    });
  });

  it('returns null when the widget is not configured', async () => {
    const env = loadEnv() as { MSG91_WIDGET_ID?: string; MSG91_WIDGET_TOKEN_AUTH?: string };
    const saved = { ...env };
    env.MSG91_WIDGET_ID = undefined;
    env.MSG91_WIDGET_TOKEN_AUTH = undefined;
    try {
      const spy = vi.spyOn(globalThis, 'fetch');
      expect(await new Msg91WidgetService().widgetInfo()).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      env.MSG91_WIDGET_ID = saved.MSG91_WIDGET_ID;
      env.MSG91_WIDGET_TOKEN_AUTH = saved.MSG91_WIDGET_TOKEN_AUTH;
    }
  });
});
