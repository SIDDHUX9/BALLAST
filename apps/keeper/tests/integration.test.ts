import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import pino from 'pino';
import {
  BallastFactoryAbi,
  BallastVaultAbi,
  MATSNET_PROTOCOL_ADDRESSES,
} from '@ballast/shared';
import { KeeperDatabase } from '../src/db.js';
import { KeeperMetrics } from '../src/metrics.js';
import { ResilientRpcManager } from '../src/rpc.js';
import { KeeperEngine } from '../src/engine.js';
import { runKeeperTick } from '../src/core/tick.js';
import type { RuntimeConfig } from '../src/config.js';

const MUSD_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

function getAnvilPath(): string {
  if (process.env.ANVIL_PATH) return process.env.ANVIL_PATH;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidate = path.join(
    home,
    '.foundry',
    'bin',
    process.platform === 'win32' ? 'anvil.exe' : 'anvil',
  );
  if (fs.existsSync(candidate)) return candidate;
  return 'anvil';
}

function makePriceFeedBytecode(priceWei: bigint): `0x${string}` {
  const hexPrice = priceWei.toString(16).padStart(64, '0');
  return `0x7f${hexPrice}60005260206000f3`;
}

// Canonical head of Mezo testnet SortedTroves list
const CANONICAL_HEAD: Address = '0x52d033E64774F31A8B7562806aA5782CbbD29382';

describe('Keeper Anvil Fork Integration Test', () => {
  let anvilProcess: ChildProcess;
  const port = 8548;
  const rpcUrl = `http://127.0.0.1:${port}`;

  const ownerPrivateKey: Hex =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const ownerAccount = privateKeyToAccount(ownerPrivateKey);

  const keeperPrivateKey: Hex =
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const keeperAccount = privateKeyToAccount(keeperPrivateKey);

  const chain = {
    id: 31611,
    name: 'Mezo Testnet Fork',
    nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
    rpcUrls: { default: { http: [rpcUrl] } },
    contracts: {
      multicall3: {
        address: '0xca11bde05977b3631167028862be2a173976ca11' as Address,
        blockCreated: 0,
      },
    },
  };

  let publicClient: ReturnType<typeof createPublicClient>;
  let ownerWallet: ReturnType<typeof createWalletClient>;
  let db: KeeperDatabase;
  let engine: KeeperEngine;
  let vaultAddress: Address;

  beforeAll(async () => {
    const anvilBin = getAnvilPath();
    anvilProcess = spawn(anvilBin, [
      '--fork-url',
      'https://rpc.test.mezo.org',
      '--fork-block-number',
      '16251640',
      '--port',
      port.toString(),
      '--chain-id',
      '31611',
      '--silent',
    ]);

    // Poll until Anvil is reachable
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' }),
        });
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (!ready) {
      throw new Error('Anvil failed to start within 10 seconds');
    }

    publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 60000 }),
      pollingInterval: 100,
    });

    ownerWallet = createWalletClient({
      account: ownerAccount,
      chain,
      transport: http(rpcUrl, { timeout: 60000 }),
      pollingInterval: 100,
    });
  }, 25000);

  afterAll(async () => {
    if (engine) {
      await engine.stop();
    }
    if (db) {
      db.close();
    }
    if (anvilProcess) {
      anvilProcess.kill('SIGTERM');
    }
  }, 30000);

  it(
    'runs the full lifecycle: creates vault, moves price, keeper defends, ICR improves',
    async () => {
      // 1. Override PriceFeed initially to $80,000 BTC price
      const initialPrice = 80000n * 10n ** 18n;
      await publicClient.request({
        method: 'anvil_setCode' as any,
        params: [MATSNET_PROTOCOL_ADDRESSES.priceFeed, makePriceFeedBytecode(initialPrice)] as any,
      });

      // 2. Create Vault for ownerAccount
      const factoryAddress = '0x8d5b392839300b487addeecc35f5bc534111cd33';

      const createTx = await ownerWallet.writeContract({
        address: factoryAddress,
        abi: BallastFactoryAbi,
        functionName: 'createVault',
        gas: 500000n,
        chain,
        account: ownerAccount,
      });
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });

      vaultAddress = (await publicClient.readContract({
        address: factoryAddress,
        abi: BallastFactoryAbi,
        functionName: 'vaultOf',
        args: [ownerAccount.address],
      })) as Address;

      expect(vaultAddress).toBeDefined();
      expect(vaultAddress).not.toBe(zeroAddress);

      // 3. Open Trove via Vault with NICR strictly higher than Head NICR
      // Collateral = 20 BTC, Debt = 2,000 MUSD -> NICR = (20 * 1e20)/2200 = 909e15 (> head at 514e15)
      // Hints: upper = address(0), lower = CANONICAL_HEAD -> inserts as new head in O(1)
      const debtAmount = 2000n * 10n ** 18n; // 2,000 MUSD
      const collAmount = parseEther('20'); // 20 BTC

      const openTx = await ownerWallet.writeContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'openTrove',
        args: [debtAmount, zeroAddress, CANONICAL_HEAD],
        value: collAmount,
        gas: 1200000n,
        chain,
        account: ownerAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: openTx });

      // 4. Configure Vault Rule: trigger = 130% (1.30e18), target = 160% (1.60e18), maxTip = 50 bps
      const setRuleTx = await ownerWallet.writeContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'setRule',
        args: [true, 130n * 10n ** 16n, 160n * 10n ** 16n, 50],
        gas: 300000n,
        chain,
        account: ownerAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: setRuleTx });

      // 5. Deposit 1,000 MUSD into Vault Defense Reserve
      const approveTx = await ownerWallet.writeContract({
        address: MATSNET_PROTOCOL_ADDRESSES.musd,
        abi: MUSD_ABI,
        functionName: 'approve',
        args: [vaultAddress, parseEther('1000')],
        gas: 100000n,
        chain,
        account: ownerAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      const depositTx = await ownerWallet.writeContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'depositMUSD',
        args: [parseEther('1000')],
        gas: 300000n,
        chain,
        account: ownerAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: depositTx });

      const reserve = await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'musdReserve',
      });
      expect(reserve).toBe(parseEther('1000'));

      // Check pre-drop defense status
      let checkDef = await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'checkDefense',
      });
      expect(checkDef[0]).toBe(false); // Defendable should be false initially

      // 6. Move BTC Price Down to $137.50
      // Collateral value = 20 BTC * $137.5 = $2,750
      // Debt = 2,200 MUSD -> ICR = $2,750 / 2,200 = 125% (< 130% trigger)
      const droppedPrice = 1375n * 10n ** 17n; // $137.50
      await publicClient.request({
        method: 'anvil_setCode' as any,
        params: [MATSNET_PROTOCOL_ADDRESSES.priceFeed, makePriceFeedBytecode(droppedPrice)] as any,
      });

      // Verify checkDefense() is now defendable = true
      checkDef = await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'checkDefense',
      });
      expect(checkDef[0]).toBe(true); // DEFENDABLE NOW!
      const icrBefore = checkDef[1];
      expect(icrBefore).toBeLessThan(130n * 10n ** 16n);
      expect(checkDef[2]).toBeGreaterThan(0n); // musdToRepay > 0

      // 7. Initialize Keeper Engine against local fork
      db = new KeeperDatabase(':memory:');
      const metrics = new KeeperMetrics();
      const logger = pino({ level: 'info' });

      const rpcManager = new ResilientRpcManager(
        [rpcUrl],
        31611,
        keeperPrivateKey,
        logger,
      );

      const keeperConfig: RuntimeConfig = {
        rpcUrls: [rpcUrl],
        chainId: 31611,
        keeperPrivateKey,
        factoryAddress,
        troveManagerAddress: MATSNET_PROTOCOL_ADDRESSES.troveManager,
        priceFeedAddress: MATSNET_PROTOCOL_ADDRESSES.priceFeed,
        sortedTrovesAddress: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
        deployBlockNumber: Number(createReceipt.blockNumber),
        pollIntervalMs: 15000,
        chunkSize: 1000,
        confirmationDepth: 0,
        minProfitMargin: 0.10,
        vaultCooldownMs: 1000,
        circuitBreakerMaxFailures: 5,
        lowBalanceThresholdBtc: '0.005',
        maxFeePerGasGwei: 50,
        altruistic: true,
        dryRun: false,
        dbPath: ':memory:',
        port: 3099,
        host: '127.0.0.1',
        logLevel: 'info',
      };

      // 8. Execute Keeper Monitor Cycle directly via src/core/tick.ts
      const tickResult = await runKeeperTick({
        publicClient,
        walletClient: rpcManager.getWalletClient(),
        store: db,
        config: keeperConfig,
        logger,
      });

      expect(tickResult.success).toBe(true);
      expect(tickResult.defensesSucceeded).toBe(1);

      // 9. Assertions:
      // A) Vault should have been defended
      const checkDefAfter = await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'checkDefense',
      });

      // ICR after defense should be >= targetICR (160% = 1.60e18) and strictly greater than icrBefore
      const icrAfter = checkDefAfter[1];
      expect(icrAfter).toBeGreaterThan(icrBefore);
      expect(checkDefAfter[0]).toBe(false); // No longer defendable

      // B) MUSD Reserve was deployed
      const reserveAfter = await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'musdReserve',
      });
      expect(reserveAfter).toBeLessThan(parseEther('1000'));

      // C) Defense record stored in SQLite
      const defenses = db.getRecentDefenses();
      expect(defenses.length).toBe(1);
      expect(defenses[0].vault.toLowerCase()).toBe(vaultAddress.toLowerCase());
      expect(defenses[0].status).toBe('confirmed');

      // D) Tick result counts
      expect(tickResult.defensesSucceeded).toBe(1);
      expect(tickResult.defensesAttempted).toBe(1);
    },
    120000,
  );
});
