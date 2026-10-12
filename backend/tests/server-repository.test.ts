import { describe, expect, it } from 'vitest';
import { createServerRepository, DuplicateServerNameError } from '../src/repositories/server-repository.js';
import { fakePool, pgError } from './support/pg-fakes.js';

const row = {
  id: '3f6f1c2e-8a4b-4c1d-9e2f-0a1b2c3d4e5f',
  name: 'pve-node-1',
  hostname: 'pve1.lan',
  ip_address: '192.168.1.10',
  operating_system: 'Proxmox VE 9',
  description: null,
  created_at: new Date('2026-10-01T12:00:00.000Z'),
  updated_at: new Date('2026-10-02T12:00:00.000Z'),
};

describe('createServerRepository', () => {
  it('createServer passes every value as a parameter with a Node-generated UUID', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [row] }));
    const name = "evil'); DROP TABLE servers; --";

    await createServerRepository(pool).createServer({ name, ipAddress: '10.0.0.5' });

    const [text, values] = query.mock.calls[0] ?? [];
    expect(text).not.toContain(name);
    expect(text).toContain('$6');
    expect(values).toEqual([expect.stringMatching(/^[0-9a-f-]{36}$/), name, null, '10.0.0.5', null, null]);
  });

  it('maps snake_case rows to camelCase servers', async () => {
    const { pool } = fakePool(async () => ({ rows: [row] }));

    await expect(createServerRepository(pool).getServerById(row.id)).resolves.toEqual({
      id: row.id,
      name: 'pve-node-1',
      hostname: 'pve1.lan',
      ipAddress: '192.168.1.10',
      operatingSystem: 'Proxmox VE 9',
      description: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it('getServerById uses a parameter and returns null when no row matches', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [] }));

    await expect(createServerRepository(pool).getServerById(row.id)).resolves.toBeNull();
    expect(query.mock.calls[0]?.[1]).toEqual([row.id]);
  });

  it('listServers orders by name', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [row] }));

    await expect(createServerRepository(pool).listServers()).resolves.toHaveLength(1);
    expect(query.mock.calls[0]?.[0]).toMatch(/ORDER BY name$/);
  });

  it('translates a unique violation on servers_name_key into DuplicateServerNameError', async () => {
    const { pool } = fakePool(async () => {
      throw pgError('23505', 'servers_name_key');
    });

    await expect(createServerRepository(pool).createServer({ name: 'dup' })).rejects.toBeInstanceOf(
      DuplicateServerNameError,
    );
  });

  it.each([
    ['a unique violation on a different constraint', pgError('23505', 'servers_pkey')],
    ['a check violation', pgError('23514', 'servers_name_not_blank')],
    ['a non-PostgreSQL error', new Error('socket hang up')],
  ])('rethrows %s unchanged', async (_case, error) => {
    const { pool } = fakePool(async () => {
      throw error;
    });

    await expect(createServerRepository(pool).createServer({ name: 'x' })).rejects.toBe(error);
  });
});
