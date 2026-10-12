import type { FastifyInstance } from 'fastify';
import type { NewServer, Server } from '../domain/server.js';
import { DuplicateServerNameError, type ServerRepository } from '../repositories/server-repository.js';
import { errorResponseSchema, nullableString, uuidParamsSchema, type ErrorResponse } from './shared-schemas.js';

const serverSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'hostname', 'ipAddress', 'operatingSystem', 'description', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    hostname: nullableString,
    ipAddress: nullableString,
    operatingSystem: nullableString,
    description: nullableString,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const createServerBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    hostname: { type: ['string', 'null'], maxLength: 253 },
    ipAddress: { type: ['string', 'null'], anyOf: [{ format: 'ipv4' }, { format: 'ipv6' }] },
    operatingSystem: { type: ['string', 'null'], maxLength: 100 },
    description: { type: ['string', 'null'] },
  },
};

export function registerServerRoutes(app: FastifyInstance, servers: ServerRepository): void {
  app.post<{ Body: NewServer; Reply: { 201: Server; 409: ErrorResponse } }>('/api/v1/servers', {
    schema: {
      body: createServerBodySchema,
      response: { 201: serverSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      const server = await servers.createServer(request.body);
      return reply.code(201).send(server);
    } catch (error) {
      if (error instanceof DuplicateServerNameError) {
        return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
      }
      throw error;
    }
  });

  app.get<{ Reply: { 200: { servers: Server[] } } }>('/api/v1/servers', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['servers'],
          properties: { servers: { type: 'array', items: serverSchema } },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.code(200).send({ servers: await servers.listServers() });
  });

  app.get<{ Params: { serverId: string }; Reply: { 200: Server; 404: ErrorResponse } }>('/api/v1/servers/:serverId', {
    schema: {
      params: uuidParamsSchema('serverId'),
      response: { 200: serverSchema, 404: errorResponseSchema },
    },
  }, async (request, reply) => {
    const server = await servers.getServerById(request.params.serverId);
    if (!server) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Server not found' });
    }
    return reply.code(200).send(server);
  });
}
