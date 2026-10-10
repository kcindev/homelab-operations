import { describe, expect, it } from 'vitest';
import { readDatabaseUrl } from '../src/config.js';

describe('readDatabaseUrl', () => {
  it('returns DATABASE_URL when it is a PostgreSQL URL', () => {
    const url = 'postgresql://user:pass@localhost:5432/db';
    expect(readDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('fails clearly when DATABASE_URL is missing or blank', () => {
    expect(() => readDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
    expect(() => readDatabaseUrl({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL is not set/);
  });

  it('rejects non-PostgreSQL URLs without echoing the value', () => {
    const secret = 'mysql://user:hunter2@localhost/db';
    expect(() => readDatabaseUrl({ DATABASE_URL: secret })).toThrow(/must start with postgresql:\/\//);
    expect(() => readDatabaseUrl({ DATABASE_URL: secret })).not.toThrow(/hunter2/);
    expect(() => readDatabaseUrl({ DATABASE_URL: 'not a url hunter2' })).toThrow('DATABASE_URL is not a valid URL.');
  });
});
