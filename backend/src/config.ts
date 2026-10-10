// Error messages must never include the DATABASE_URL value, since it contains the password.
export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      'DATABASE_URL is not set. Set it in the environment or in backend/.env (see backend/.env.example).',
    );
  }

  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  if (protocol !== 'postgresql:' && protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://.');
  }

  return value;
}
