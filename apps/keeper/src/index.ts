import pino from 'pino';
import { BRAND_NAME } from '@ballast/shared';
import { loadConfig } from './config.js';
import { KeeperDatabase } from './db.js';
import { KeeperMetrics } from './metrics.js';
import { ResilientRpcManager } from './rpc.js';
import { KeeperEngine } from './engine.js';
import { buildServer } from './server.js';
import type { Hex } from 'viem';

async function main() {
  const config = loadConfig();

  const logger = pino({
    level: config.logLevel,
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  });

  logger.info(
    {
      brand: BRAND_NAME,
      chainId: config.chainId,
      factory: config.factoryAddress,
      dryRun: config.dryRun,
      altruistic: config.altruistic,
      pollIntervalMs: config.pollIntervalMs,
    },
    `Starting ${BRAND_NAME} Keeper Service`,
  );

  const db = new KeeperDatabase(config.dbPath);
  const metrics = new KeeperMetrics();

  const rpcManager = new ResilientRpcManager(
    config.rpcUrls,
    config.chainId,
    config.dryRun ? undefined : (config.keeperPrivateKey as Hex),
    logger,
  );

  const engine = new KeeperEngine(config, db, metrics, rpcManager, logger);

  // Initialize Telegram Bot & Outbox Worker if token is configured
  let botService: import('./telegram/bot.js').TelegramBotService | undefined;
  let outboxWorker: import('./telegram/outbox.js').NotificationOutboxWorker | undefined;

  if (config.telegramBotToken) {
    const { TelegramBotService } = await import('./telegram/bot.js');
    const { NotificationOutboxWorker } = await import('./telegram/outbox.js');

    botService = new TelegramBotService({
      token: config.telegramBotToken,
      db,
      publicClient: rpcManager.getPublicClient(),
      factoryAddress: config.factoryAddress,
      logger,
    });

    outboxWorker = new NotificationOutboxWorker(db, botService, logger);

    await botService.start();
    outboxWorker.start();
    logger.info('Telegram Bot service and Notification Outbox worker active');
  } else {
    logger.info(
      'TELEGRAM_BOT_TOKEN not provided; Telegram bot polling and outbox delivery are dormant',
    );
  }

  const server = buildServer(
    {
      engine,
      metrics,
      rpcManager,
      db,
      config,
      botService,
    },
    config.logLevel,
  );

  // Graceful shutdown handling
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Received termination signal, shutting down gracefully...');

    try {
      if (outboxWorker) outboxWorker.stop();
      if (botService) await botService.stop();
      await engine.stop();
      await server.close();
      db.close();
      logger.info('Clean shutdown completed.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.listen({ port: config.port, host: config.host });
    logger.info(
      `Fastify server listening on http://${config.host}:${config.port} (/healthz, /metrics, /signals, /defenses, /api/telegram/*)`,
    );

    await engine.start();
  } catch (err) {
    logger.fatal({ err }, 'Failed to start keeper service');
    process.exit(1);
  }
}

// Only auto-start when executed directly
if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}
