import { DatabaseError, type Pool } from 'pg';
import { vi } from 'vitest';

export function fakePool(query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>) {
  const spy = vi.fn(query);
  return { pool: { query: spy } as unknown as Pool, query: spy };
}

export function pgError(code: string, constraint?: string): DatabaseError {
  return Object.assign(new DatabaseError('database error', 0, 'error'), { code, constraint });
}
