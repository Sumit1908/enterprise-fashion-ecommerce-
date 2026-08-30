import { describe, expect, it } from 'vitest';
import { money, round2, toNumber } from './money.js';

describe('round2', () => {
  it('rounds to 2dp without float drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2099 * 0.05)).toBe(104.95);
    expect(round2(1.005)).toBe(1.01);
  });
});

describe('toNumber', () => {
  it('handles null, strings and Decimal-like objects', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('49.00')).toBe(49);
    expect(toNumber({ toString: () => '12.5' } as unknown as number)).toBe(12.5);
  });
});

describe('money', () => {
  it('always renders 2 decimal places', () => {
    expect(money(0)).toBe('0.00');
    expect(money(2148)).toBe('2148.00');
    expect(money(99.9)).toBe('99.90');
  });
});
