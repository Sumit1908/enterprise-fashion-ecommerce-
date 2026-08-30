import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('lowercases, strips accents and non-alphanumerics', () => {
    expect(slugify('Café  Crème — Déjà Vu!')).toBe('cafe-creme-deja-vu');
  });

  it('trims leading/trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });

  it('caps length at 80 chars', () => {
    expect(slugify('x'.repeat(200)).length).toBe(80);
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    expect(await uniqueSlug('Blue Jeans', async () => false)).toBe('blue-jeans');
  });

  it('appends -2, -3, … until a free slug is found', async () => {
    const taken = new Set(['blue-jeans', 'blue-jeans-2']);
    expect(await uniqueSlug('Blue Jeans', async (s) => taken.has(s))).toBe('blue-jeans-3');
  });
});
