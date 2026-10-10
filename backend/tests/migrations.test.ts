import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadMigrations, migrationsDirectory } from '../src/db/migrate.js';

describe('loadMigrations', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'homelab-migrations-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('returns .sql files in file name order and ignores other files', async () => {
    await writeFile(join(directory, '0002_second.sql'), 'SELECT 2;');
    await writeFile(join(directory, '0010_tenth.sql'), 'SELECT 10;');
    await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;');
    await writeFile(join(directory, 'README.md'), '# notes');

    const migrations = await loadMigrations(directory);

    expect(migrations).toEqual([
      { name: '0001_first.sql', sql: 'SELECT 1;' },
      { name: '0002_second.sql', sql: 'SELECT 2;' },
      { name: '0010_tenth.sql', sql: 'SELECT 10;' },
    ]);
  });

  it('rejects .sql files that do not follow the NNNN_description.sql convention', async () => {
    await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;');
    await writeFile(join(directory, '2_bad-name.sql'), 'SELECT 2;');

    await expect(loadMigrations(directory)).rejects.toThrow(/Invalid migration file name\(s\): 2_bad-name\.sql/);
  });

  it('loads the real migrations directory', async () => {
    await expect(loadMigrations(migrationsDirectory)).resolves.toBeInstanceOf(Array);
  });
});
