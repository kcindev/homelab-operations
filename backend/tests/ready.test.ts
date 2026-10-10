import { expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

it('GET /api/v1/ready returns 200 when the database check succeeds', async () => {
  const checkDatabase = vi.fn(async () => {});
  const app = buildApp({ checkDatabase }, { logger: false });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ status: 'ready', database: 'ok' });
    expect(checkDatabase).toHaveBeenCalledOnce();
  } finally {
    await app.close();
  }
});

it('GET /api/v1/ready returns 503 without leaking error details when the database check fails', async () => {
  const secretDetail = 'password authentication failed for postgresql://user:hunter2@db/x';
  const checkDatabase = vi.fn(async () => {
    throw new Error(secretDetail);
  });
  const app = buildApp({ checkDatabase }, { logger: false });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ status: 'not_ready', database: 'unavailable' });
    expect(response.body).not.toContain('hunter2');
    expect(response.body).not.toContain(secretDetail);
  } finally {
    await app.close();
  }
});
