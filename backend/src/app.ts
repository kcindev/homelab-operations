import Fastify, { type FastifyServerOptions } from 'fastify';
import type { ServerRepository } from './repositories/server-repository.js';
import type { ServiceRepository } from './repositories/service-repository.js';
import { registerServerRoutes } from './routes/servers.js';
import { registerServiceRoutes } from './routes/services.js';

export interface AppDependencies {
  /** Resolves when the database answers a trivial query; rejects otherwise. */
  checkDatabase: () => Promise<void>;
  serverRepository: ServerRepository;
  serviceRepository: ServiceRepository;
}

export function buildApp(dependencies: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
    ...options,
  });

  // Fastify's default handler puts error.message and error.code in 500 responses,
  // which would expose PostgreSQL error details. 4xx errors keep the default handling.
  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    if (statusCode < 500) {
      return reply.send(error);
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  app.get<{ Reply: { status: 'ok' } }>('/api/v1/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: { status: { type: 'string', enum: ['ok'] } },
        },
      },
    },
  }, async () => ({ status: 'ok' }));

  app.get<{
    Reply: {
      200: { status: 'ready'; database: 'ok' };
      503: { status: 'not_ready'; database: 'unavailable' };
    };
  }>('/api/v1/ready', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'database'],
          properties: {
            status: { type: 'string', enum: ['ready'] },
            database: { type: 'string', enum: ['ok'] },
          },
        },
        503: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'database'],
          properties: {
            status: { type: 'string', enum: ['not_ready'] },
            database: { type: 'string', enum: ['unavailable'] },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      await dependencies.checkDatabase();
    } catch (error) {
      request.log.error({ err: error }, 'Readiness check failed: database unavailable');
      return reply.code(503).send({ status: 'not_ready', database: 'unavailable' });
    }
    return reply.code(200).send({ status: 'ready', database: 'ok' });
  });

  registerServerRoutes(app, dependencies.serverRepository);
  registerServiceRoutes(app, dependencies.serviceRepository, dependencies.serverRepository);

  return app;
}
