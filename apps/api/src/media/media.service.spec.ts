import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
// Simulate a configured Supabase Storage bucket.
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.S3_BUCKET = 'product-media';
process.env.S3_ENDPOINT = 'https://abcdefghijkl.supabase.co/storage/v1/s3';
process.env.AWS_REGION = 'ap-south-1';
delete process.env.S3_PUBLIC_BASE_URL;

let MediaService: typeof import('./media.service.js').MediaService;

beforeAll(async () => {
  ({ MediaService } = await import('./media.service.js'));
});
afterAll(() => {
  for (const k of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_ENDPOINT']) {
    delete process.env[k];
  }
});

describe('MediaService (Supabase S3-compatible)', () => {
  it('uses the S3 driver and derives the Supabase public object URL', () => {
    const m = new MediaService();
    expect(m.driver).toBe('s3');
    expect(m.config().persistent).toBe(true);
    expect(m.publicBaseUrl()).toBe(
      'https://abcdefghijkl.supabase.co/storage/v1/object/public/product-media',
    );
  });

  it('round-trips a URL back to its storage key', () => {
    const m = new MediaService();
    const url = `${m.publicBaseUrl()}/products/2026/09/11111111-2222-3333-4444-555555555555.webp`;
    expect(m.keyFromUrl(url)).toBe(
      'products/2026/09/11111111-2222-3333-4444-555555555555.webp',
    );
    expect(m.keyFromUrl('https://evil.example.com/x.png')).toBeNull();
  });

  it('rejects video types unless MEDIA_ALLOW_VIDEO is on', () => {
    const m = new MediaService();
    expect(m.config().acceptedTypes).toContain('image/webp');
    expect(m.config().acceptedTypes).not.toContain('video/mp4');
  });

  it('delete() no-ops for a URL it does not own, without throwing', async () => {
    const m = new MediaService();
    await expect(m.delete('https://cdn.someoneelse.com/a.jpg')).resolves.toEqual({
      deleted: false,
      key: null,
    });
  });
});
