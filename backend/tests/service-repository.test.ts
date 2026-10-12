import { describe, expect, it } from 'vitest';
import {
  createServiceRepository,
  DuplicateServiceNameError,
  ServerNotFoundError,
} from '../src/repositories/service-repository.js';
import { fakePool, pgError } from './support/pg-fakes.js';

const serverId = '11111111-1111-4111-8111-111111111111';

const row = {
  id: '3f6f1c2e-8a4b-4c1d-9e2f-0a1b2c3d4e5f',
  server_id: serverId,
  name: 'PostgreSQL',
  description: 'Primary database',
  created_at: new Date('2026-10-03T12:00:00.000Z'),
  updated_at: new Date('2026-10-04T12:00:00.000Z'),
};

describe('createServiceRepository', () => {
  it('createService passes every value as a parameter with a Node-generated UUID', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [row] }));
    const name = "evil'); DROP TABLE services; --";
    const description = "x' OR '1'='1";

    await createServiceRepository(pool).createService(serverId, { name, description });

    const [text, values] = query.mock.calls[0] ?? [];
    expect(text).toMatch(/VALUES \(\$1, \$2, \$3, \$4\)/);
    expect(text).not.toContain(name);
    expect(text).not.toContain(description);
    expect(text).not.toContain(serverId);
    expect(values).toEqual([expect.stringMatching(/^[0-9a-f-]{36}$/), serverId, name, description]);
  });

  it('createService sends null when description is omitted and a fresh UUID per call', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [row] }));
    const repository = createServiceRepository(pool);

    await repository.createService(serverId, { name: 'a' });
    await repository.createService(serverId, { name: 'b' });

    const firstValues = query.mock.calls[0]?.[1];
    const secondValues = query.mock.calls[1]?.[1];
    expect(firstValues?.[3]).toBeNull();
    expect(firstValues?.[0]).not.toBe(secondValues?.[0]);
  });

  it('maps snake_case rows to camelCase services', async () => {
    const { pool } = fakePool(async () => ({ rows: [row] }));

    await expect(createServiceRepository(pool).createService(serverId, { name: 'PostgreSQL' })).resolves.toEqual({
      id: row.id,
      serverId,
      name: 'PostgreSQL',
      description: 'Primary database',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it('listServicesByServerId filters with server_id = $1 and orders by name', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [row] }));

    const services = await createServiceRepository(pool).listServicesByServerId(serverId);

    const [text, values] = query.mock.calls[0] ?? [];
    expect(text).toMatch(/WHERE server_id = \$1 ORDER BY name$/);
    expect(text).not.toContain(serverId);
    expect(values).toEqual([serverId]);
    expect(services).toEqual([expect.objectContaining({ serverId, name: 'PostgreSQL' })]);
  });

  it('getServiceById uses id = $1 and returns null when no row matches', async () => {
    const { pool, query } = fakePool(async () => ({ rows: [] }));

    await expect(createServiceRepository(pool).getServiceById(row.id)).resolves.toBeNull();

    const [text, values] = query.mock.calls[0] ?? [];
    expect(text).toMatch(/WHERE id = \$1$/);
    expect(values).toEqual([row.id]);
  });

  it.each([
    ['23505 on services_server_id_name_key', pgError('23505', 'services_server_id_name_key'), DuplicateServiceNameError],
    ['23503 on services_server_id_fkey', pgError('23503', 'services_server_id_fkey'), ServerNotFoundError],
  ])('translates %s into a domain error', async (_case, error, expected) => {
    const { pool } = fakePool(async () => {
      throw error;
    });

    await expect(createServiceRepository(pool).createService(serverId, { name: 'x' })).rejects.toBeInstanceOf(expected);
  });

  it.each([
    ['23505 on a different constraint', pgError('23505', 'services_pkey')],
    ['23503 on a different constraint', pgError('23503', 'some_other_fkey')],
    ['a check violation', pgError('23514', 'services_name_not_blank')],
    ['a matching constraint name with a different code', pgError('23514', 'services_server_id_name_key')],
    ['a non-PostgreSQL error', new Error('socket hang up')],
  ])('rethrows %s unchanged', async (_case, error) => {
    const { pool } = fakePool(async () => {
      throw error;
    });

    await expect(createServiceRepository(pool).createService(serverId, { name: 'x' })).rejects.toBe(error);
  });
});
