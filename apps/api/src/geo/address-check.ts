/**
 * Heuristics for the checkout street-address field.
 *
 * Goal: reject obvious placeholder / keyboard-mash input ("asdf", "test", "123")
 * without rejecting real — often terse — Indian addresses like
 * "24 MG Road, Near City Mall" or "House No. 42, Sector 15".
 */

const DEVANAGARI = 'ऀ-ॿ';

const JUNK_TOKENS = new Set([
  'test',
  'testtest',
  'testing',
  'asdf',
  'asdfasdf',
  'asdfgh',
  'asdfghjkl',
  'qwerty',
  'qwertyuiop',
  'qwer',
  'zxcv',
  'zxcvbn',
  'abc',
  'abcd',
  'abcde',
  'abcabc',
  'xyz',
  'xyzxyz',
  'abcxyz',
  'lorem',
  'loremipsum',
  'dummy',
  'sample',
  'nothing',
  'none',
  'nil',
  'na',
  'null',
  'undefined',
  'address',
  'myaddress',
  'home',
]);

/** Normalise for comparison: lowercase, strip accents, collapse whitespace. */
export function normaliseText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlausibleStreetAddress(raw: string): boolean {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 10) return false;

  const alphaRe = new RegExp(`[a-zA-Z${DEVANAGARI}]`, 'g');
  const alpha = text.match(alphaRe) ?? [];
  if (alpha.length < 4) return false;

  // Meaningful tokens (2+ real chars), ignoring pure separators.
  const wordCharRe = new RegExp(`[^a-zA-Z0-9${DEVANAGARI}]`, 'g');
  const words = text
    .split(/[\s,./#-]+/)
    .filter((w) => w.replace(wordCharRe, '').length >= 2);
  if (words.length < 2) return false;

  const hasDigit = /\d/.test(text);
  // A real address is specific: it has a number, or at least three words.
  if (!hasDigit && words.length < 3) return false;

  const compact = normaliseText(text).replace(/[^a-z0-9]/g, '');
  // The whole thing is a single placeholder word, possibly repeated.
  if (JUNK_TOKENS.has(compact)) return false;
  for (const token of JUNK_TOKENS) {
    if (
      token.length >= 3 &&
      compact.length > 0 &&
      compact.split(token).join('') === ''
    ) {
      return false;
    }
  }
  // One character hammered on the keyboard ("aaaaaa", "......").
  if (/^(.)\1{4,}$/.test(compact)) return false;

  // Latin gibberish: long alpha run with almost no vowels ("sdfghjkl").
  const latin = normaliseText(text).replace(/[^a-z]/g, '');
  if (latin.length >= 8) {
    const vowels = (latin.match(/[aeiou]/g) ?? []).length;
    if (vowels / latin.length < 0.12) return false;
  }

  return true;
}
