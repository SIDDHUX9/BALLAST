import Fastify, { FastifyInstance } from 'fastify';
import { BRAND_NAME } from '@ballast/shared';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  app.get('/health', async () => {
    return {
      service: `${BRAND_NAME} Keeper Service`,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}
