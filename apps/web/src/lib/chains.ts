import { defineChain } from 'viem';

/**
 * Mezo Testnet (Matsnet) Chain Definition
 * Chain ID: 31611 (0x7b7b)
 * Verified against on-chain RPC https://rpc.test.mezo.org
 */
export const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.test.mezo.org'],
      webSocket: ['wss://rpc-ws.test.mezo.org'],
    },
    public: {
      http: ['https://rpc.test.mezo.org'],
      webSocket: ['wss://rpc-ws.test.mezo.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mezo Explorer',
      url: 'https://explorer.test.mezo.org',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 3669328,
    },
  },
  testnet: true,
});

export const MEZO_TESTNET_CHAIN_ID = 31611;
export const FAUCET_URL = 'https://faucet.test.mezo.org';
export const EXPLORER_URL = 'https://explorer.test.mezo.org';
