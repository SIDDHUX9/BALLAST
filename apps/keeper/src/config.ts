import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import type { Address, Hex } from 'viem';
import { MATSNET_PROTOCOL_ADDRESSES } from '@ballast/shared';

export const ConfigSchema = z.object({
  rpcUrls: z.array(z.string().url()).min(1),
  chainId: z.number().int().positive(),
  keeperPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid 32-byte hex private key'),
  factoryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((val) => val as Address),
  troveManagerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((val) => val as Address),
  priceFeedAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((val) => val as Address),
  sortedTrovesAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((val) => val as Address),
  deployBlockNumber: z.number().int().positive(),
  pollIntervalMs: z.number().int().min(1000).default(15000),
  chunkSize: z.number().int().min(10).max(10000).default(2000),
  confirmationDepth: z.number().int().min(0).max(100).default(6),
  minProfitMargin: z.number().min(0).default(0.10), // 10% expected profit above estimated gas cost
  vaultCooldownMs: z.number().int().min(0).default(60000), // 60s per vault
  circuitBreakerMaxFailures: z.number().int().min(1).default(5),
  lowBalanceThresholdBtc: z.string().default('0.005'),
  maxFeePerGasGwei: z.number().positive().default(50),
  altruistic: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  dbPath: z.string().default('ballast-keeper.db'),
  port: z.number().int().min(1024).max(65535).default(3001),
  host: z.string().default('0.0.0.0'),
  webOrigin: z.string().default('http://localhost:3000'),
  telegramBotToken: z.string().optional(),
  telegramBotUsername: z.string().default('ballast_alert_bot'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type RuntimeConfig = z.infer<typeof ConfigSchema>;

function findDeploymentJson(): { factory?: string; deployBlock?: number } {
  const possiblePaths = [
    path.resolve(process.cwd(), 'deployments/matsnet.json'),
    path.resolve(process.cwd(), '../../deployments/matsnet.json'),
    path.resolve(process.cwd(), '../deployments/matsnet.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return {
          factory: raw.ballastFactory,
          deployBlock: raw.deployBlockNumber ?? raw.deployedAtBlock,
        };
      } catch {
        // ignore parse errors and fallback
      }
    }
  }
  return {};
}

function resolvePrivateKey(): string {
  // 1. Explicit env var
  if (process.env.KEEPER_PRIVATE_KEY) {
    return process.env.KEEPER_PRIVATE_KEY.trim();
  }

  // 2. Secret file path
  if (process.env.KEEPER_PRIVATE_KEY_FILE && fs.existsSync(process.env.KEEPER_PRIVATE_KEY_FILE)) {
    return fs.readFileSync(process.env.KEEPER_PRIVATE_KEY_FILE, 'utf-8').trim();
  }

  // 3. Fallback to root PRIVATE_KEY (for testing/local development)
  if (process.env.PRIVATE_KEY) {
    return process.env.PRIVATE_KEY.trim();
  }

  // Default dummy private key (will validate hex format)
  return '0x0000000000000000000000000000000000000000000000000000000000000001';
}

export function loadConfig(cliArgs: string[] = process.argv.slice(2)): RuntimeConfig {
  const deployment = findDeploymentJson();

  // Parse command line flags
  const cliOptions = {
    'dry-run': { type: 'boolean' as const, default: false },
    altruistic: { type: 'boolean' as const, default: false },
    'db-path': { type: 'string' as const },
    port: { type: 'string' as const },
    'poll-interval': { type: 'string' as const },
    'log-level': { type: 'string' as const },
  };

  let parsedCliValues: Record<string, string | boolean | undefined> = {};

  try {
    const res = parseArgs({
      args: cliArgs,
      options: cliOptions,
      allowPositionals: true,
      strict: false,
    });
    parsedCliValues = res.values;
  } catch {
    // ignore unrecognized flags
  }

  const rawRpcUrls = process.env.KEEPER_RPC_URLS
    ? process.env.KEEPER_RPC_URLS.split(',').map((u) => u.trim())
    : [process.env.KEEPER_RPC_URL || 'https://rpc.test.mezo.org'];

  const rawConfig = {
    rpcUrls: rawRpcUrls,
    chainId: Number(process.env.KEEPER_CHAIN_ID || '31611'),
    keeperPrivateKey: resolvePrivateKey(),
    factoryAddress:
      process.env.KEEPER_FACTORY_ADDRESS ||
      deployment.factory ||
      '0x8d5b392839300b487addeecc35f5bc534111cd33',
    troveManagerAddress:
      process.env.KEEPER_TROVE_MANAGER_ADDRESS || MATSNET_PROTOCOL_ADDRESSES.troveManager,
    priceFeedAddress:
      process.env.KEEPER_PRICE_FEED_ADDRESS || MATSNET_PROTOCOL_ADDRESSES.priceFeed,
    sortedTrovesAddress:
      process.env.KEEPER_SORTED_TROVES_ADDRESS || MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
    deployBlockNumber: Number(
      process.env.KEEPER_DEPLOY_BLOCK || deployment.deployBlock || 16251639,
    ),
    pollIntervalMs: Number(
      parsedCliValues['poll-interval'] || process.env.KEEPER_POLL_INTERVAL_MS || 15000,
    ),
    chunkSize: Number(process.env.KEEPER_CHUNK_SIZE || 2000),
    confirmationDepth: Number(process.env.KEEPER_CONFIRMATION_DEPTH || 6),
    minProfitMargin: Number(process.env.KEEPER_MIN_PROFIT_MARGIN || 0.10),
    vaultCooldownMs: Number(process.env.KEEPER_VAULT_COOLDOWN_MS || 60000),
    circuitBreakerMaxFailures: Number(process.env.KEEPER_CIRCUIT_BREAKER_MAX_FAILURES || 5),
    lowBalanceThresholdBtc: process.env.KEEPER_LOW_BALANCE_THRESHOLD_BTC || '0.005',
    maxFeePerGasGwei: Number(process.env.KEEPER_MAX_FEE_PER_GAS_GWEI || 50),
    altruistic: Boolean(
      parsedCliValues.altruistic || process.env.KEEPER_ALTRUISTIC === 'true',
    ),
    dryRun: Boolean(parsedCliValues['dry-run'] || process.env.KEEPER_DRY_RUN === 'true'),
    dbPath: (parsedCliValues['db-path'] as string) || process.env.KEEPER_DB_PATH || 'ballast-keeper.db',
    port: Number(parsedCliValues.port || process.env.PORT || 3001),
    host: process.env.HOST || '0.0.0.0',
    webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || 'ballast_alert_bot',
    logLevel: ((parsedCliValues['log-level'] as string) || process.env.LOG_LEVEL || 'info') as
      | 'fatal'
      | 'error'
      | 'warn'
      | 'info'
      | 'debug'
      | 'trace',
  };

  return ConfigSchema.parse(rawConfig);
}
