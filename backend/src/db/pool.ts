import { Pool } from 'pg';

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    // The pg default (0) waits forever for a connection, which would hang /ready.
    connectionTimeoutMillis: 5_000,
  });
}
