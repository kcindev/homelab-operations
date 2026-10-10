import type { Pool } from 'pg';
import { readDatabaseUrl } from '../config.js';
import { getDatabaseInfo } from '../db/connectivity.js';
import { createPool } from '../db/pool.js';
import { describeError } from './describe-error.js';

let pool: Pool | undefined;
try {
  pool = createPool(readDatabaseUrl());
  const info = await getDatabaseInfo(pool);
  console.log('PostgreSQL connection OK');
  console.log(`  database:       ${info.database}`);
  console.log(`  user:           ${info.username}`);
  console.log(`  server version: ${info.serverVersion}`);
  console.log(`  server time:    ${info.serverTime.toISOString()}`);
} catch (error) {
  console.error(`Database check failed: ${describeError(error)}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
