import { Prisma } from '@slay/db';

/** Round to 2 decimal places, avoiding binary-float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value.toString());
}

/** Format a number as a fixed 2dp string for API responses / Decimal columns. */
export function money(n: number): string {
  return round2(n).toFixed(2);
}
