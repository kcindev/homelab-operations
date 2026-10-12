import type { FastifyInstance } from 'fastify';
import type { NewService, Service } from '../domain/service.js';
import type { ServerRepository } from '../repositories/server-repository.js';
import {
  DuplicateServiceNameError,
  ServerNotFoundError,
  type ServiceRepository,
} from '../repositories/service-repository.js';
import { errorResponseSchema, nullableString, uuidParamsSchema, type ErrorResponse } from './shared-schemas.js';

const serviceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'serverId', 'name', 'description', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    serverId: { type: 'string' },
    name: { type: 'string' },
    description: nullableString,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const createServiceBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
    description: { type: ['string', 'null'] },
  },
};

const serverNotFound: ErrorResponse = { statusCode: 404, error: 'Not Found', message: 'Server not found' };

export function registerServiceRoutes(
  app: FastifyInstance,
  services: ServiceRepository,
  servers: ServerRepository,
): void {
  app.post<{
    Params: { serverId: string };
    Body: NewService;
    Reply: { 201: Service; 404: ErrorResponse; 409: ErrorResponse };
  }>('/api/v1/servers/:serverId/services', {
    schema: {
      params: uuidParamsSchema('serverId'),
      body: createServiceBodySchema,
      response: { 201: serviceSchema, 404: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      const service = await services.createService(request.params.serverId, request.body);
      return reply.code(201).send(service);
    } catch (error) {
      if (error instanceof ServerNotFoundError) {
        return reply.code(404).send(serverNotFound);
      }
      if (error instanceof DuplicateServiceNameError) {
        return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: error.message });
      }
      throw error;
    }
  });

  app.get<{
    Params: { serverId: string };
    Reply: { 200: { services: Service[] }; 404: ErrorResponse };
  }>('/api/v1/servers/:serverId/services', {
    schema: {
      params: uuidParamsSchema('serverId'),
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['services'],
          properties: { services: { type: 'array', items: serviceSchema } },
        },
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { serverId } = request.params;
    if (!(await servers.getServerById(serverId))) {
      return reply.code(404).send(serverNotFound);
    }
    return reply.code(200).send({ services: await services.listServicesByServerId(serverId) });
  });

  app.get<{ Params: { serviceId: string }; Reply: { 200: Service; 404: ErrorResponse } }>('/api/v1/services/:serviceId', {
    schema: {
      params: uuidParamsSchema('serviceId'),
      response: { 200: serviceSchema, 404: errorResponseSchema },
    },
  }, async (request, reply) => {
    const service = await services.getServiceById(request.params.serviceId);
    if (!service) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Service not found' });
    }
    return reply.code(200).send(service);
  });
}
