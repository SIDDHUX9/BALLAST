import { KeeperConfigSchema, KeeperConfig } from '@ballast/shared';

export function loadConfig(): KeeperConfig {
  const rawConfig = {
    rpcUrl: process.env.KEEPER_RPC_URL || 'https://rpc.test.mezo.org',
    chainId: Number(process.env.KEEPER_CHAIN_ID || '31611'),
    keeperPrivateKey:
      process.env.KEEPER_PRIVATE_KEY ||
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    pollIntervalMs: Number(process.env.KEEPER_POLL_INTERVAL_MS || '5000'),
    minProfitUsd: Number(process.env.KEEPER_MIN_PROFIT_USD || '1.0'),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
  };

  return KeeperConfigSchema.parse(rawConfig);
}
