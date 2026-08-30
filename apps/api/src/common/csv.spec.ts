import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRecords, toCsv } from './csv.js';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas, quotes and newlines', () => {
    const csv = 'name,note\n"Levi\'s, Inc.","He said ""hi""\nnext line"';
    expect(parseCsv(csv)).toEqual([
      ['name', 'note'],
      ["Levi's, Inc.", 'He said "hi"\nnext line'],
    ]);
  });

  it('strips a BOM and tolerates CRLF + trailing newline', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops fully blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCsvRecords', () => {
  it('keys cells by the header row and trims', () => {
    expect(parseCsvRecords('slug, name \ntest-1, Jean One ')).toEqual([
      { slug: 'test-1', name: 'Jean One' },
    ]);
  });

  it('returns [] when there is no data row', () => {
    expect(parseCsvRecords('slug,name')).toEqual([]);
  });
});

describe('toCsv', () => {
  it('round-trips through parseCsv, escaping as needed', () => {
    const headers = ['a', 'b'];
    const rows = [{ a: 'x,y', b: 'plain' }, { a: 'has "quote"', b: '' }];
    const parsed = parseCsv(toCsv(headers, rows));
    expect(parsed).toEqual([
      ['a', 'b'],
      ['x,y', 'plain'],
      ['has "quote"', ''],
    ]);
  });
});
