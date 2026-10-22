import { getDefaultConfig, WalletList } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rabbyWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { cookieStorage, createStorage, http } from 'wagmi';
import { mezoTestnet } from './chains';
import { OrangeKitBitcoinProvider } from '@mezo-org/orangekit/dist/src/wallet/bitcoin-wallet-provider.js';
import { createOrangeKitConnector } from '@mezo-org/orangekit/dist/src/wallet/connector.js';
import { OrangeKitWalletId } from '@mezo-org/orangekit/dist/src/wallet/types.js';
import { getWalletInjectedProvider } from '@mezo-org/orangekit/dist/src/wallet/utils.js';
import unisatIcon from '@mezo-org/orangekit/dist/src/wallet/unisat/icon.js';
import okxIcon from '@mezo-org/orangekit/dist/src/wallet/okx/icon.js';
import xverseIcon from '@mezo-org/orangekit/dist/src/wallet/xverse/icon.js';

// Project ID for WalletConnect (use environment variable or public fallback for local development)
export const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '21fef48091f12692cad574a6f7753643';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.test.mezo.org';
const CHAIN_ID = 31611;

/**
 * SSR-safe Bitcoin wallet definitions via Mezo OrangeKit / Passport.
 * Synchronously checks window presence only when invoked, preventing SSR crashes.
 */
function createSafeUnisatConnector() {
  const provider = typeof window !== 'undefined' ? getWalletInjectedProvider(OrangeKitWalletId.UNISAT) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSR safe dummy provider before browser injection
  const btcProvider = new OrangeKitBitcoinProvider((provider || {}) as any);
  return createOrangeKitConnector(OrangeKitWalletId.UNISAT, 'Unisat', unisatIcon, RPC_URL, CHAIN_ID, btcProvider);
}

function createSafeOKXConnector() {
  const provider = typeof window !== 'undefined' ? getWalletInjectedProvider(OrangeKitWalletId.OKX) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSR safe dummy provider before browser injection
  const btcProvider = new OrangeKitBitcoinProvider((provider || {}) as any);
  return createOrangeKitConnector(OrangeKitWalletId.OKX, 'OKX', okxIcon, RPC_URL, CHAIN_ID, btcProvider);
}

function createSafeXverseConnector() {
  const provider = typeof window !== 'undefined' ? getWalletInjectedProvider(OrangeKitWalletId.XVERSE) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSR safe dummy provider before browser injection
  const btcProvider = new OrangeKitBitcoinProvider((provider || {}) as any);
  return createOrangeKitConnector(OrangeKitWalletId.XVERSE, 'Xverse', xverseIcon, RPC_URL, CHAIN_ID, btcProvider);
}

export const unisatWallet = () => ({
  id: 'orangekit-unisat',
  name: 'UniSat (Bitcoin)',
  iconUrl: 'https://www.svgrepo.com/show/74027/orange.svg',
  iconAccent: '#1E1E1E',
  iconBackground: '#1E1E1E',
  installed: typeof window !== 'undefined' && !!(window as any).unisat,
  createConnector: createSafeUnisatConnector,
  downloadUrls: {
    desktop: 'https://chromewebstore.google.com/detail/unisat-wallet/ppbibelpcjmhbdihakflkdcoccbgbkpo',
  },
});

export const okxWallet = () => ({
  id: 'orangekit-okx',
  name: 'OKX (Bitcoin)',
  iconUrl: 'https://www.svgrepo.com/show/74027/orange.svg',
  iconAccent: '#1E1E1E',
  iconBackground: '#1E1E1E',
  installed: typeof window !== 'undefined' && !!(window as any).okxwallet?.bitcoin,
  createConnector: createSafeOKXConnector,
  downloadUrls: {
    desktop: 'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
  },
});

export const xverseWallet = () => ({
  id: 'orangekit-xverse',
  name: 'Xverse (Bitcoin)',
  iconUrl: 'https://www.svgrepo.com/show/74027/orange.svg',
  iconAccent: '#1E1E1E',
  iconBackground: '#1E1E1E',
  installed: typeof window !== 'undefined' && !!(window as any).XverseProviders?.BitcoinProvider,
  createConnector: createSafeXverseConnector,
  downloadUrls: {
    desktop: 'https://www.xverse.app/download',
  },
});

// Configure wallet groups: Bitcoin wallets first, then EVM wallets
const walletGroups: WalletList = [
  {
    groupName: 'Bitcoin wallets',
    wallets: [unisatWallet, okxWallet, xverseWallet],
  },
  {
    groupName: 'EVM wallets',
    wallets: [
      metaMaskWallet,
      rabbyWallet,
      coinbaseWallet,
      walletConnectWallet,
      rainbowWallet,
    ],
  },
];

// E2E test-only double (strictly isolated to NEXT_PUBLIC_E2E=1)
if (process.env.NEXT_PUBLIC_E2E === '1') {
  // Dynamically require to ensure production build excludes the test connector
  try {
    const { getE2EBurnerWallet } = require('./test-connector');
    walletGroups.push({
      groupName: 'Test Doubles (E2E Only)',
      wallets: [getE2EBurnerWallet()],
    });
  } catch {
    // Ignore in non-e2e environments
  }
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Ballast',
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http(RPC_URL),
  },
  wallets: walletGroups,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
