import { buildApp } from './app.js';
import { readDatabaseUrl } from './config.js';
import { checkDatabaseConnection } from './db/connectivity.js';
import { createPool } from './db/pool.js';

const pool = createPool(readDatabaseUrl());
const app = buildApp({ checkDatabase: () => checkDatabaseConnection(pool) });
const port = Number(process.env.PORT ?? '3001');
const host = process.env.HOST ?? '127.0.0.1';

// Without a listener, an error on an idle pooled client (e.g. PostgreSQL restarting) crashes the process.
pool.on('error', (error) => app.log.error({ err: error }, 'Unexpected error on idle PostgreSQL client'));
app.addHook('onClose', async () => {
  await pool.end();
});

async function shutdown() {
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}
