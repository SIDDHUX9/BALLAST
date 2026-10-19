import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';
import { KeeperDatabase } from '../src/db.js';
import { KeeperMetrics } from '../src/metrics.js';
import { BRAND_NAME } from '@ballast/shared';

describe('Keeper Fastify Server Endpoints', () => {
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

  it('exposes detailed status on /healthz', async () => {
    const db = new KeeperDatabase(':memory:');
    const metrics = new KeeperMetrics();

    // Mock engine & rpcManager context
    const mockCtx = {
      engine: {
        getState: () => ({
          isRunning: true,
          isShuttingDown: false,
          inFlightTxsCount: 0,
          lastCycleTimestamp: '2026-10-20T00:00:00Z',
          lastSuccessfulCycle: '2026-10-20T00:00:00Z',
          consecutiveFailures: 0,
          circuitBreakerTripped: false,
          activeRpcUrl: 'https://rpc.test.mezo.org',
        }),
        earlyWarningService: {
          getAllLatestSignals: () => [],
        },
      } as any,
      metrics,
      rpcManager: {
        getHealthStatus: () => ({
          activeUrl: 'https://rpc.test.mezo.org',
          isHealthy: true,
          lastCheckedAt: '2026-10-20T00:00:00Z',
          lastBlockNumber: 16251700n,
          failoverCount: 0,
        }),
      } as any,
      db,
    };

    const server = buildServer(mockCtx);
    const res = await server.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.circuitBreakerTripped).toBe(false);
    expect(body.rpc.isHealthy).toBe(true);
    db.close();
  });

  it('returns 503 on /healthz when circuit breaker is tripped', async () => {
    const db = new KeeperDatabase(':memory:');
    const metrics = new KeeperMetrics();

    const mockCtx = {
      engine: {
        getState: () => ({
          isRunning: true,
          isShuttingDown: false,
          inFlightTxsCount: 0,
          lastCycleTimestamp: '2026-10-20T00:00:00Z',
          lastSuccessfulCycle: '2026-10-20T00:00:00Z',
          consecutiveFailures: 5,
          circuitBreakerTripped: true, // TRIPPED
          activeRpcUrl: 'https://rpc.test.mezo.org',
        }),
        earlyWarningService: {
          getAllLatestSignals: () => [],
        },
      } as any,
      metrics,
      rpcManager: {
        getHealthStatus: () => ({
          activeUrl: 'https://rpc.test.mezo.org',
          isHealthy: true,
          lastCheckedAt: '2026-10-20T00:00:00Z',
          lastBlockNumber: 16251700n,
          failoverCount: 0,
        }),
      } as any,
      db,
    };

    const server = buildServer(mockCtx);
    const res = await server.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('degraded');
    expect(body.circuitBreakerTripped).toBe(true);
    db.close();
  });

  it('serves prometheus metrics on /metrics', async () => {
    const db = new KeeperDatabase(':memory:');
    const metrics = new KeeperMetrics();
    metrics.setVaultsTracked(15);
    metrics.incrementSuccess();

    const mockCtx = {
      engine: {} as any,
      metrics,
      rpcManager: {} as any,
      db,
    };

    const server = buildServer(mockCtx);
    const res = await server.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('keeper_vaults_tracked 15');
    expect(res.body).toContain('keeper_defenses_total{status="success"} 1');
    db.close();
  });

  it('returns recent defenses audit log on /defenses', async () => {
    const db = new KeeperDatabase(':memory:');
    db.saveDefense({
      vault: '0x1111111111111111111111111111111111111111',
      txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
      keeper: '0x3333333333333333333333333333333333333333',
      blockNumber: 100,
      musdRepaid: '1000',
      btcAdded: '0',
      musdTip: '5',
      btcTip: '0',
      oldIcr: '1150000000000000000',
      newIcr: '1500000000000000000',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });

    const mockCtx = {
      engine: {} as any,
      metrics: new KeeperMetrics(),
      rpcManager: {} as any,
      db,
    };

    const server = buildServer(mockCtx);
    const res = await server.inject({
      method: 'GET',
      url: '/defenses',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.length).toBe(1);
    expect(body[0].musdRepaid).toBe('1000');
    expect(body[0].status).toBe('confirmed');
    db.close();
  });
});
