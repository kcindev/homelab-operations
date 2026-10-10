import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

// Resolves to backend/migrations from both src/db (tsx) and dist/db (compiled),
// because tsc does not copy .sql files into dist.
export const migrationsDirectory = fileURLToPath(new URL('../../migrations', import.meta.url));

const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/;

export interface Migration {
  name: string;
  sql: string;
}

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const sqlFiles = (await readdir(directory)).filter((file) => file.endsWith('.sql'));

  const invalid = sqlFiles.filter((file) => !migrationFilePattern.test(file));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid migration file name(s): ${invalid.join(', ')}. Expected NNNN_description.sql, e.g. 0001_create_example.sql`,
    );
  }

  const migrations: Migration[] = [];
  for (const file of sqlFiles.sort()) {
    migrations.push({ name: file, sql: await readFile(join(directory, file), 'utf8') });
  }
  return migrations;
}

export async function runMigrations(
  pool: Pool,
  migrations: readonly Migration[],
  log: (message: string) => void,
): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const result = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const alreadyApplied = new Set(result.rows.map((row) => row.name));
    const pending = migrations.filter((migration) => !alreadyApplied.has(migration.name));

    const appliedNow: string[] = [];
    for (const migration of pending) {
      log(`Applying ${migration.name}`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        log(`Rolled back ${migration.name}`);
        throw error;
      }
      appliedNow.push(migration.name);
    }
    return appliedNow;
  } finally {
    client.release();
  }
}
