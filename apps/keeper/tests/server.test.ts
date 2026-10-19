import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';
import { BRAND_NAME } from '@ballast/shared';

describe('Keeper Fastify Server', () => {
  it('returns healthy status on /health endpoint', async () => {
    const server = buildServer();
    const res = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toContain(BRAND_NAME);
  });
});
