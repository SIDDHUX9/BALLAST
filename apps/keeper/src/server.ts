import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { BRAND_NAME } from '@ballast/shared';
import type { KeeperEngine } from './engine.js';
import type { KeeperMetrics } from './metrics.js';
import type { ResilientRpcManager } from './rpc.js';
import type { KeeperDatabase } from './db.js';
import type { RuntimeConfig } from './config.js';
import type { TelegramBotService } from './telegram/bot.js';
import { registerTelegramRoutes } from './telegram/routes.js';

export interface ServerContext {
  engine: KeeperEngine;
  metrics: KeeperMetrics;
  rpcManager: ResilientRpcManager;
  db: KeeperDatabase;
  config?: RuntimeConfig;
  botService?: TelegramBotService;
}

export function buildServer(ctx?: ServerContext, logLevel: string = 'info'): FastifyInstance {
  const app = Fastify({
    logger: {
      level: logLevel,
    },
  });

  // CORS locked to configured web origin
  app.register(cors, {
    origin: ctx?.config?.webOrigin
      ? [ctx.config.webOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']
      : '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Global rate limiter
  app.register(rateLimit, {
    max: 100,
    timeWindow: '15 minutes',
  });

  // Telegram HTTP API routes
  if (ctx && typeof ctx.rpcManager?.getPublicClient === 'function') {
    registerTelegramRoutes(app, {
      db: ctx.db,
      publicClient: ctx.rpcManager.getPublicClient(),
      botUsername: ctx.config?.telegramBotUsername || 'ballast_alert_bot',
      botService: ctx.botService,
    });
  }

  // Basic info endpoint
  app.get('/health', async () => {
    return {
      service: `${BRAND_NAME} Keeper Service`,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Detailed Kubernetes/Docker health check
  app.get('/healthz', async (request, reply) => {
    if (!ctx) {
      return { status: 'ok', service: `${BRAND_NAME} Keeper` };
    }

    const state = ctx.engine.getState();
    const rpcStatus = ctx.rpcManager.getHealthStatus();

    const isHealthy =
      rpcStatus.isHealthy &&
      !state.circuitBreakerTripped &&
      state.isRunning;

    const statusCode = isHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      status: isHealthy ? 'ok' : 'degraded',
      service: `${BRAND_NAME} Keeper`,
      circuitBreakerTripped: state.circuitBreakerTripped,
      consecutiveFailures: state.consecutiveFailures,
      rpc: {
        activeUrl: rpcStatus.activeUrl,
        isHealthy: rpcStatus.isHealthy,
        lastBlockNumber: rpcStatus.lastBlockNumber.toString(),
        failoverCount: rpcStatus.failoverCount,
      },
      lastCycleTimestamp: state.lastCycleTimestamp,
      lastSuccessfulCycle: state.lastSuccessfulCycle,
      inFlightTxsCount: state.inFlightTxsCount,
      timestamp: new Date().toISOString(),
    });
  });

  // Prometheus Metrics endpoint
  app.get('/metrics', async (request, reply) => {
    if (!ctx) {
      return reply.type('text/plain; version=0.0.4').send('');
    }

    const text = ctx.metrics.toPrometheusFormat();
    return reply.type('text/plain; version=0.0.4').send(text);
  });

  // Early warning signals query
  app.get('/signals', async () => {
    if (!ctx) return [];
    return ctx.engine.earlyWarningService.getAllLatestSignals().map((s) => ({
      vault: s.vault,
      icr: s.icr.toString(),
      icrPercent: s.icrPercent,
      blockNumber: s.blockNumber,
      timestamp: s.timestamp,
      isNearTrigger: s.isNearTrigger,
    }));
  });

  // Recent defenses audit log
  app.get('/defenses', async (request) => {
    if (!ctx) return [];
    const query = request.query as { limit?: string };
    const limit = query.limit ? Math.min(100, Math.max(1, Number(query.limit))) : 50;
    return ctx.db.getRecentDefenses(limit);
  });

  return app;
}
