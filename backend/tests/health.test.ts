import { expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

it('GET /api/v1/health returns the healthy JSON response without touching the database', async () => {
  const checkDatabase = vi.fn(async () => {
    throw new Error('database is down');
  });
  const app = buildApp({ checkDatabase }, { logger: false });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ status: 'ok' });
    expect(checkDatabase).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
