import pino from 'pino';
import { BRAND_NAME } from '@ballast/shared';
import { loadConfig } from './config.js';
import { MemoryStore } from './core/memory-store.js';
import { ResilientRpcManager } from './rpc.js';
import { runKeeperTick } from './core/tick.js';
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
    `Starting ${BRAND_NAME} Keeper Core Runner (Convex Backend Active)`,
  );

  const store = new MemoryStore();
  const rpcManager = new ResilientRpcManager(
    config.rpcUrls,
    config.chainId,
    config.dryRun ? undefined : (config.keeperPrivateKey as Hex),
    logger,
  );

  const tickResult = await runKeeperTick({
    publicClient: rpcManager.getPublicClient(),
    walletClient: rpcManager.getWalletClient(),
    store,
    config: {
      factoryAddress: config.factoryAddress,
      troveManagerAddress: config.troveManagerAddress,
      priceFeedAddress: config.priceFeedAddress,
      sortedTrovesAddress: config.sortedTrovesAddress,
      deployBlockNumber: config.deployBlockNumber,
      chunkSize: config.chunkSize,
      confirmationDepth: config.confirmationDepth,
      minProfitMargin: config.minProfitMargin,
      vaultCooldownMs: config.vaultCooldownMs,
      circuitBreakerMaxFailures: config.circuitBreakerMaxFailures,
      altruistic: config.altruistic,
      dryRun: config.dryRun,
    },
    logger,
  });

  logger.info(
    {
      success: tickResult.success,
      discovered: tickResult.newVaultsDiscovered,
      defensesAttempted: tickResult.defensesAttempted,
      defensesSucceeded: tickResult.defensesSucceeded,
    },
    'Local keeper tick cycle completed',
  );
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}
