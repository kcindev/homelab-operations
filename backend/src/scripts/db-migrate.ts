import type { Pool } from 'pg';
import { readDatabaseUrl } from '../config.js';
import { loadMigrations, migrationsDirectory, runMigrations } from '../db/migrate.js';
import { createPool } from '../db/pool.js';
import { describeError } from './describe-error.js';

let pool: Pool | undefined;
try {
  pool = createPool(readDatabaseUrl());
  const migrations = await loadMigrations(migrationsDirectory);
  const applied = await runMigrations(pool, migrations, (message) => console.log(message));
  console.log(
    applied.length === 0
      ? `No pending migrations (${migrations.length} migration file(s) found).`
      : `Applied ${applied.length} migration(s).`,
  );
} catch (error) {
  console.error(`Migration failed: ${describeError(error)}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
