import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Server } from '../src/domain/server.js';
import type { Service } from '../src/domain/service.js';
import { createInMemoryServerRepository } from './support/in-memory-server-repository.js';
import { createInMemoryServiceRepository } from './support/in-memory-service-repository.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const unknownId = '00000000-0000-4000-8000-000000000000';

function makeServer(id: string, name: string): Server {
  const at = new Date('2026-10-01T12:00:00.000Z');
  return { id, name, hostname: null, ipAddress: null, operatingSystem: null, description: null, createdAt: at, updatedAt: at };
}

const serverA = makeServer('11111111-1111-4111-8111-111111111111', 'pve-node-1');
const serverB = makeServer('22222222-2222-4222-8222-222222222222', 'pve-node-2');

const existingService: Service = {
  id: '3f6f1c2e-8a4b-4c1d-9e2f-0a1b2c3d4e5f',
  serverId: serverA.id,
  name: 'PostgreSQL',
  description: 'Primary database',
  createdAt: new Date('2026-10-03T12:00:00.000Z'),
  updatedAt: new Date('2026-10-04T12:00:00.000Z'),
};

const existingServiceJson = {
  ...existingService,
  createdAt: '2026-10-03T12:00:00.000Z',
  updatedAt: '2026-10-04T12:00:00.000Z',
};

let app: FastifyInstance | undefined;

function createApp(options: { services?: Service[] } = {}) {
  const serverRepository = createInMemoryServerRepository([serverA, serverB]);
  const serviceRepository = createInMemoryServiceRepository(serverRepository, options.services);
  const spies = {
    getServerById: vi.spyOn(serverRepository, 'getServerById'),
    createService: vi.spyOn(serviceRepository, 'createService'),
    listServicesByServerId: vi.spyOn(serviceRepository, 'listServicesByServerId'),
    getServiceById: vi.spyOn(serviceRepository, 'getServiceById'),
  };
  app = buildApp({ checkDatabase: async () => {}, serverRepository, serviceRepository }, { logger: false });
  return { app, serviceRepository, spies };
}

function expectNoRepositoryCalls(spies: ReturnType<typeof createApp>['spies']) {
  for (const spy of Object.values(spies)) {
    expect(spy).not.toHaveBeenCalled();
  }
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('POST /api/v1/servers/:serverId/services', () => {
  const url = `/api/v1/servers/${serverA.id}/services`;

  it('creates a service and returns 201 with the camelCase resource', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'POST',
      url,
      payload: { name: 'PostgreSQL', description: 'Primary database' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({
      id: expect.stringMatching(uuidPattern),
      serverId: serverA.id,
      name: 'PostgreSQL',
      description: 'Primary database',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
  });

  it.each([
    ['omitted', {}],
    ['explicitly null', { description: null }],
  ])('returns 201 with a null description when it is %s', async (_case, extra) => {
    const { app } = createApp();

    const response = await app.inject({ method: 'POST', url, payload: { name: 'Grafana', ...extra } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: 'Grafana', description: null });
  });

  it.each([
    ['missing name', { description: 'no name' }],
    ['empty name', { name: '' }],
    ['whitespace-only name', { name: ' \t\n ' }],
    ['name over 100 characters', { name: 'a'.repeat(101) }],
    ['numeric name (no type coercion)', { name: 123 }],
    ['numeric description (no type coercion)', { name: 'ok', description: 42 }],
    ['unknown property (not silently removed)', { name: 'ok', healthcheckUrl: 'http://x' }],
  ])('returns 400 without calling repositories for %s', async (_case, payload) => {
    const { app, spies } = createApp();

    const response = await app.inject({ method: 'POST', url, payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: 'Bad Request', code: 'FST_ERR_VALIDATION' });
    expectNoRepositoryCalls(spies);
  });

  it.each([['not-a-uuid'], [`urn:uuid:${serverA.id}`]])(
    'returns 400 without calling repositories for invalid server id %s',
    async (serverId) => {
      const { app, spies } = createApp();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/servers/${encodeURIComponent(serverId)}/services`,
        payload: { name: 'PostgreSQL' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'FST_ERR_VALIDATION' });
      expectNoRepositoryCalls(spies);
    },
  );

  it('returns 404 when the parent server does not exist', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/servers/${unknownId}/services`,
      payload: { name: 'PostgreSQL' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Server not found' });
  });

  it('returns 409 when the same server already has a service with that name', async () => {
    const { app } = createApp({ services: [existingService] });

    const response = await app.inject({ method: 'POST', url, payload: { name: existingService.name } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'A service with this name already exists on this server',
    });
  });

  it('allows the same service name on a different server', async () => {
    const { app } = createApp({ services: [existingService] });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/servers/${serverB.id}/services`,
      payload: { name: existingService.name },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ serverId: serverB.id, name: existingService.name });
  });

  it('returns a generic 500 without leaking details for unexpected repository errors', async () => {
    const { app, serviceRepository } = createApp();
    serviceRepository.createService = async () => {
      throw Object.assign(new Error('insert into services failed: postgresql://app:hunter2@db'), { code: '57P01' });
    };

    const response = await app.inject({ method: 'POST', url, payload: { name: 'boom' } });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
    expect(response.body).not.toContain('hunter2');
    expect(response.body).not.toContain('57P01');
    expect(response.body).not.toContain('services');
  });
});

describe('GET /api/v1/servers/:serverId/services', () => {
  it('returns 200 with an empty list for an existing server without services', async () => {
    const { app } = createApp({ services: [existingService] });

    const response = await app.inject({ method: 'GET', url: `/api/v1/servers/${serverB.id}/services` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ services: [] });
  });

  it("returns only that server's services, sorted by name", async () => {
    const { app } = createApp({ services: [existingService] });
    for (const name of ['Prometheus', 'Grafana']) {
      await app.inject({ method: 'POST', url: `/api/v1/servers/${serverA.id}/services`, payload: { name } });
    }
    await app.inject({ method: 'POST', url: `/api/v1/servers/${serverB.id}/services`, payload: { name: 'Caddy' } });

    const response = await app.inject({ method: 'GET', url: `/api/v1/servers/${serverA.id}/services` });

    expect(response.statusCode).toBe(200);
    const { services } = response.json<{ services: { name: string; serverId: string }[] }>();
    expect(services.map((s) => s.name)).toEqual(['Grafana', 'PostgreSQL', 'Prometheus']);
    expect(services.every((s) => s.serverId === serverA.id)).toBe(true);
    expect(services[1]).toEqual(existingServiceJson);
  });

  it('returns 404 instead of an empty list when the server does not exist', async () => {
    const { app, spies } = createApp();

    const response = await app.inject({ method: 'GET', url: `/api/v1/servers/${unknownId}/services` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Server not found' });
    expect(spies.listServicesByServerId).not.toHaveBeenCalled();
  });

  it('returns 400 without calling repositories for an invalid server id', async () => {
    const { app, spies } = createApp();

    const response = await app.inject({ method: 'GET', url: '/api/v1/servers/not-a-uuid/services' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, code: 'FST_ERR_VALIDATION' });
    expectNoRepositoryCalls(spies);
  });
});

describe('GET /api/v1/services/:serviceId', () => {
  it('returns 200 with the service when it exists', async () => {
    const { app } = createApp({ services: [existingService] });

    const response = await app.inject({ method: 'GET', url: `/api/v1/services/${existingService.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(existingServiceJson);
  });

  it('returns 404 for a valid UUID that does not exist', async () => {
    const { app } = createApp({ services: [existingService] });

    const response = await app.inject({ method: 'GET', url: `/api/v1/services/${unknownId}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Service not found' });
  });

  it.each([['not-a-uuid'], ['12345'], [`urn:uuid:${existingService.id}`]])(
    'returns 400 without calling repositories for invalid id %s',
    async (serviceId) => {
      const { app, spies } = createApp({ services: [existingService] });

      const response = await app.inject({ method: 'GET', url: `/api/v1/services/${encodeURIComponent(serviceId)}` });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, code: 'FST_ERR_VALIDATION' });
      expectNoRepositoryCalls(spies);
    },
  );
});
