import { describe, expect, it } from 'vitest';
import { isPlausibleStreetAddress } from './address-check.js';

describe('isPlausibleStreetAddress', () => {
  it('accepts real, terse Indian addresses', () => {
    for (const good of [
      '24 MG Road, Near City Mall',
      'House No. 42, Sector 15, Main Road',
      'Flat 3B, Sunrise Apartments, Linking Road, Bandra West',
      'Plot 12, Phase 2, Gachibowli',
      'B-7, Lajpat Nagar II',
      'Door No 5/123, Gandhi Street, Adyar',
      'Near Hanuman Mandir, Station Road, Lalganj Ajhara',
    ]) {
      expect(isPlausibleStreetAddress(good), good).toBe(true);
    }
  });

  it('rejects placeholder / keyboard-mash input', () => {
    for (const bad of [
      '',
      '   ',
      'abc',
      'xyz',
      'test',
      '123',
      'asdf',
      'qwerty',
      'asdfasdf',
      'test test',
      'asdf asdf asdf',
      'aaaaaaaaaa',
      '..........',
      '1234567890',
      'qwertyuiop',
    ]) {
      expect(isPlausibleStreetAddress(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});
