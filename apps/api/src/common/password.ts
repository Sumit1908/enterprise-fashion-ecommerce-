import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

/** Format: `scrypt$<saltHex>$<hashHex>` — matches the DB seed script. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(plain, salt, KEYLEN);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hashHex) return false;
  const derived = await scrypt(plain, salt, KEYLEN);
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
