import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Server } from '../src/domain/server.js';
import type { ServerRepository } from '../src/repositories/server-repository.js';
import { createInMemoryServerRepository } from './support/in-memory-server-repository.js';
import { createInMemoryServiceRepository } from './support/in-memory-service-repository.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const existingServer: Server = {
  id: '3f6f1c2e-8a4b-4c1d-9e2f-0a1b2c3d4e5f',
  name: 'pve-node-1',
  hostname: 'pve1.lan',
  ipAddress: '192.168.1.10',
  operatingSystem: 'Proxmox VE 9',
  description: 'Primary hypervisor',
  createdAt: new Date('2026-10-01T12:00:00.000Z'),
  updatedAt: new Date('2026-10-02T12:00:00.000Z'),
};

const existingServerJson = {
  ...existingServer,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
};

let app: FastifyInstance | undefined;

function createApp(serverRepository: ServerRepository = createInMemoryServerRepository()) {
  app = buildApp(
    {
      checkDatabase: async () => {},
      serverRepository,
      serviceRepository: createInMemoryServiceRepository(serverRepository),
    },
    { logger: false },
  );
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('POST /api/v1/servers', () => {
  it('creates a server and returns 201 with the camelCase resource', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: {
        name: 'nas-1',
        hostname: 'nas1.lan',
        ipAddress: '192.168.1.20',
        operatingSystem: 'TrueNAS SCALE',
        description: 'Storage',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      id: expect.stringMatching(uuidPattern),
      name: 'nas-1',
      hostname: 'nas1.lan',
      ipAddress: '192.168.1.20',
      operatingSystem: 'TrueNAS SCALE',
      description: 'Storage',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
  });

  it('accepts only a name and returns null for the optional fields', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: { name: 'minimal' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: 'minimal',
      hostname: null,
      ipAddress: null,
      operatingSystem: null,
      description: null,
    });
  });

  it('accepts an IPv6 address and explicit nulls', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: { name: 'v6-host', ipAddress: '2001:db8::1', hostname: null, description: null },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ ipAddress: '2001:db8::1', hostname: null, description: null });
  });

  it.each([
    ['missing name', { hostname: 'no-name.lan' }],
    ['empty name', { name: '' }],
    ['whitespace-only name', { name: ' \t ' }],
    ['name over 100 characters', { name: 'a'.repeat(101) }],
    ['hostname over 253 characters', { name: 'x', hostname: 'h'.repeat(254) }],
    ['operatingSystem over 100 characters', { name: 'x', operatingSystem: 'o'.repeat(101) }],
    ['invalid IP address', { name: 'x', ipAddress: '999.1.1.1' }],
    ['non-IP text as IP address', { name: 'x', ipAddress: 'not-an-ip' }],
    ['CIDR instead of an address', { name: 'x', ipAddress: '10.0.0.0/24' }],
  ])('returns 400 for %s', async (_case, payload) => {
    const response = await createApp().inject({ method: 'POST', url: '/api/v1/servers', payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: 'Bad Request', code: 'FST_ERR_VALIDATION' });
  });

  it.each([
    ['a number instead of a string name (no type coercion)', { name: 123 }],
    ['an unknown field (not silently removed)', { name: 'test', unknownField: 'value' }],
  ])('returns 400 without calling the repository for %s', async (_case, payload) => {
    const repository = createInMemoryServerRepository();
    const createServer = vi.spyOn(repository, 'createServer');

    const response = await createApp(repository).inject({ method: 'POST', url: '/api/v1/servers', payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: 'Bad Request', code: 'FST_ERR_VALIDATION' });
    expect(createServer).not.toHaveBeenCalled();
  });

  it('returns 409 when the name is already taken', async () => {
    const server = createApp(createInMemoryServerRepository([existingServer]));

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: { name: existingServer.name },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'A server with this name already exists',
    });
  });

  it('returns a generic 500 without leaking details for unexpected repository errors', async () => {
    const failing = createInMemoryServerRepository();
    failing.createServer = async () => {
      throw Object.assign(new Error('connection to postgresql://app:hunter2@db failed'), { code: '08006' });
    };

    const response = await createApp(failing).inject({
      method: 'POST',
      url: '/api/v1/servers',
      payload: { name: 'boom' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
    expect(response.body).not.toContain('hunter2');
    expect(response.body).not.toContain('08006');
  });
});

describe('GET /api/v1/servers', () => {
  it('returns an empty list when there are no servers', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/api/v1/servers' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ servers: [] });
  });

  it('returns servers in name order', async () => {
    const server = createApp(createInMemoryServerRepository([existingServer]));
    await server.inject({ method: 'POST', url: '/api/v1/servers', payload: { name: 'alpha' } });

    const response = await server.inject({ method: 'GET', url: '/api/v1/servers' });

    expect(response.statusCode).toBe(200);
    const { servers } = response.json<{ servers: { name: string }[] }>();
    expect(servers.map((s) => s.name)).toEqual(['alpha', 'pve-node-1']);
    expect(servers[1]).toEqual(existingServerJson);
  });
});

describe('GET /api/v1/servers/:serverId', () => {
  it('returns 200 with the server when it exists', async () => {
    const response = await createApp(createInMemoryServerRepository([existingServer])).inject({
      method: 'GET',
      url: `/api/v1/servers/${existingServer.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(existingServerJson);
  });

  it('returns 404 for a valid UUID that does not exist', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/api/v1/servers/00000000-0000-4000-8000-000000000000',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Server not found' });
  });

  it.each([
    ['not-a-uuid'],
    ['12345'],
    ['3f6f1c2e-8a4b-4c1d-9e2f-0a1b2c3d4e5'],
    ['urn:uuid:3f6f1c2e-8a4b-4c1d-9e2f-0a1b2c3d4e5f'],
  ])('returns 400 without querying the repository for invalid id %s', async (serverId) => {
    const repository = createInMemoryServerRepository();
    let lookups = 0;
    repository.getServerById = async () => {
      lookups += 1;
      return null;
    };

    const response = await createApp(repository).inject({
      method: 'GET',
      url: `/api/v1/servers/${encodeURIComponent(serverId)}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, code: 'FST_ERR_VALIDATION' });
    expect(lookups).toBe(0);
  });
});
