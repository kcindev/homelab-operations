import Fastify, { type FastifyServerOptions } from 'fastify';

export interface AppDependencies {
  /** Resolves when the database answers a trivial query; rejects otherwise. */
  checkDatabase: () => Promise<void>;
}

export function buildApp(dependencies: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify({ logger: true, ...options });

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

  return app;
}
