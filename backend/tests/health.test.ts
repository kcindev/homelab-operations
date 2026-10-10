import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

it('GET /api/v1/health returns the healthy JSON response', async () => {
  const app = buildApp({ logger: false });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ status: 'ok' });
  } finally {
    await app.close();
  }
});
