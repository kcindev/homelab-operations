import type { Pool } from 'pg';

export async function checkDatabaseConnection(pool: Pool): Promise<void> {
  await pool.query('SELECT 1');
}

export interface DatabaseInfo {
  database: string;
  username: string;
  serverVersion: string;
  serverTime: Date;
}

export async function getDatabaseInfo(pool: Pool): Promise<DatabaseInfo> {
  const result = await pool.query<{
    database: string;
    username: string;
    server_version: string;
    server_time: Date;
  }>(`
    SELECT
      current_database() AS database,
      current_user AS username,
      current_setting('server_version') AS server_version,
      now() AS server_time
  `);

  const row = result.rows[0];
  if (!row) {
    throw new Error('Database info query returned no rows');
  }

  return {
    database: row.database,
    username: row.username,
    serverVersion: row.server_version,
    serverTime: row.server_time,
  };
}
