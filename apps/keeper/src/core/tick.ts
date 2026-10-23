import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  formatEther,
  parseEventLogs,
  zeroAddress,
} from 'viem';
import {
  BallastVaultAbi,
  computeLiquidationPrice,
  computeAbsorptionCapacity,
  PRECISION,
} from '@ballast/shared';
import type {
  StoreInterface,
  CoreConfig,
  Clock,
  TickResult,
} from './types.js';
import type { CheckDefenseOutput, DefenseRecord, VaultRule } from '../types.js';
import { discoverVaults } from './discovery.js';
import { calculateProfitability } from './profitability.js';
import { CooldownTracker } from './cooldown.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { AlertEvaluator } from './alerts.js';
import { computeDefenseHints } from '../hints.js';
import { MINIMAL_TROVE_MANAGER_ABI } from '../telegram/types.js';

export interface TickDependencies {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  store: StoreInterface;
  config: CoreConfig;
  clock?: Clock;
  cooldownTracker?: CooldownTracker;
  circuitBreaker?: CircuitBreaker;
  alertEvaluator?: AlertEvaluator;
  logger?: { debug: Function; info: Function; warn: Function; error: Function };
}

export async function runKeeperTick(deps: TickDependencies): Promise<TickResult> {
  const {
    publicClient,
    walletClient,
    store,
    config,
    logger,
  } = deps;

  const clock = deps.clock ?? (() => Date.now());
  const cooldownTracker = deps.cooldownTracker ?? new CooldownTracker(config.vaultCooldownMs, clock);
  const circuitBreaker = deps.circuitBreaker ?? new CircuitBreaker(config.circuitBreakerMaxFailures, clock);
  const alertEvaluator = deps.alertEvaluator ?? new AlertEvaluator(store, 15.0, clock);

  const startTime = clock();
  const maxDuration = config.maxTickDurationMs ?? 45000;

  // 1. Check Circuit Breaker
  if (circuitBreaker.checkTripped()) {
    logger?.warn?.(
      { failures: circuitBreaker.getFailuresCount() },
      'Circuit breaker is tripped — skipping defense evaluation in this tick',
    );
    return {
      success: false,
      fromBlock: 0,
      toBlock: 0,
      newVaultsDiscovered: 0,
      totalVaultsTracked: await store.getVaultCount(),
      vaultsEvaluated: 0,
      defensesAttempted: 0,
      defensesSucceeded: 0,
      defensesFailed: 0,
      notificationsQueued: 0,
      circuitBreakerTripped: true,
      error: 'Circuit breaker is tripped',
    };
  }

  // 2. Discover Vaults
  const discovery = await discoverVaults(
    publicClient,
    store,
    {
      factoryAddress: config.factoryAddress,
      deployBlockNumber: config.deployBlockNumber,
      chunkSize: config.chunkSize,
      confirmationDepth: config.confirmationDepth,
      maxBlocks: config.maxBlocksPerTick,
    },
    logger,
  );

  const vaults = await store.getAllVaults();
  if (vaults.length === 0) {
    logger?.debug?.('No vaults discovered yet');
    return {
      success: true,
      fromBlock: discovery.fromBlock,
      toBlock: discovery.toBlock,
      newVaultsDiscovered: discovery.newVaultsCount,
      totalVaultsTracked: 0,
      vaultsEvaluated: 0,
      defensesAttempted: 0,
      defensesSucceeded: 0,
      defensesFailed: 0,
      notificationsQueued: 0,
      circuitBreakerTripped: false,
    };
  }

  // 3. Batch Check Defenses & Trove States
  const checkDefenseCalls = vaults.map((v) => ({
    address: v.address,
    abi: BallastVaultAbi,
    functionName: 'checkDefense' as const,
  }));

  const ruleCalls = vaults.map((v) => ({
    address: v.address,
    abi: BallastVaultAbi,
    functionName: 'rule' as const,
  }));

  const troveStatusCalls = vaults.map((v) => ({
    address: config.troveManagerAddress,
    abi: MINIMAL_TROVE_MANAGER_ABI,
    functionName: 'getTroveStatus' as const,
    args: [v.address],
  }));

  const [defenseResults, ruleResults, statusResults, gasPrice, latestBlockBigInt] = await Promise.all([
    publicClient.multicall({ contracts: checkDefenseCalls }),
    publicClient.multicall({ contracts: ruleCalls }),
    publicClient.multicall({ contracts: troveStatusCalls }),
    publicClient.getGasPrice(),
    publicClient.getBlockNumber(),
  ]);

  const currentBlock = Number(latestBlockBigInt);

  // Read PriceFeed price
  let btcPriceWei = 80000n * PRECISION;
  try {
    const rawPrice = await publicClient.readContract({
      address: config.priceFeedAddress,
      abi: [{
        type: 'function',
        name: 'fetchPrice',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
      }],
      functionName: 'fetchPrice',
    }) as bigint;
    if (rawPrice > 0n) btcPriceWei = rawPrice;
  } catch (err) {
    logger?.warn?.({ err }, 'Error fetching oracle price, using fallback');
  }

  let defensesAttempted = 0;
  let defensesSucceeded = 0;
  let defensesFailed = 0;
  let notificationsQueued = 0;

  // 4. Evaluate Each Vault
  for (let i = 0; i < vaults.length; i++) {
    // Check execution budget
    if (clock() - startTime > maxDuration) {
      logger?.warn?.('Tick time budget reached, finishing cycle early');
      break;
    }

    const vault = vaults[i];
    const defRes = defenseResults[i];
    const ruleRes = ruleResults[i];
    const statusRes = statusResults[i];

    if (statusRes.status === 'success') {
      const statusNum = Number(statusRes.result);
      if (statusNum !== 1) { // 1 = active
        let endedStatus: 'closedByOwner' | 'closedByLiquidation' | 'closedByRedemption' = 'closedByOwner';
        if (statusNum === 3) endedStatus = 'closedByLiquidation';
        else if (statusNum === 4) endedStatus = 'closedByRedemption';

        await alertEvaluator.emitPositionEndedAlert({
          vault: vault.address,
          status: endedStatus,
        });
        continue;
      }
    }

    if (defRes.status !== 'success') {
      continue;
    }

    const [defendable, currentIcr, musdRepay, btcTopup] = defRes.result as [boolean, bigint, bigint, bigint];
    const rule = ruleRes.status === 'success'
      ? (ruleRes.result as [boolean, bigint, bigint, number])
      : [false, 0n, 0n, 50];

    const maxTipBps = Number(rule[3]);
    const triggerIcr = BigInt(rule[1]);

    // Record snapshot into store
    await store.saveIcrSnapshot({
      vault: vault.address,
      icr: currentIcr.toString(),
      blockNumber: currentBlock,
      timestamp: Math.floor(clock() / 1000),
    });

    // Check early warning alerts
    const users = await store.getTelegramUsersForAddress(vault.address);
    if (users.length > 0) {
      const watchPercent = users[0].watchPercent ?? 150.0;
      const liqPrice = computeLiquidationPrice(0n, 0n, 1100000000000000000n);
      const firedWarning = await alertEvaluator.evaluateWarningAlert({
        vault: vault.address,
        currentIcr,
        watchLevelPercent: watchPercent,
        triggerIcrPercent: Number((triggerIcr * 10000n) / PRECISION) / 100,
        liquidationPrice: liqPrice,
      });
      if (firedWarning) notificationsQueued++;
    }

    // Evaluate defense need
    if (!defendable) {
      continue;
    }

    // Check cooldown
    if (cooldownTracker.isCoolingDown(vault.address)) {
      logger?.debug?.(
        { vault: vault.address, remainingMs: cooldownTracker.getRemainingCooldownMs(vault.address) },
        'Vault is in cooldown, skipping defense',
      );
      continue;
    }

    // Check profitability
    const estimatedGas = 800000n;
    const profit = calculateProfitability({
      musdToRepay: musdRepay,
      btcToAdd: btcTopup,
      maxTipBps,
      btcPriceWei,
      estimatedGas,
      gasPriceWei: gasPrice,
      minProfitMargin: config.minProfitMargin,
      altruistic: config.altruistic,
    });

    if (!profit.isProfitable) {
      logger?.info?.(
        {
          vault: vault.address,
          tipUsd: profit.expectedTipUsd.toFixed(2),
          gasCostUsd: profit.estimatedGasCostUsd.toFixed(2),
        },
        'Defense unprofitable, skipping',
      );
      continue;
    }

    defensesAttempted++;

    if (config.dryRun || !walletClient || !walletClient.account) {
      logger?.info?.(
        { vault: vault.address, tipUsd: profit.expectedTipUsd.toFixed(2), dryRun: true },
        'Dry-run defense simulation passed',
      );
      defensesSucceeded++;
      continue;
    }

    // Compute insertion hints
    try {
      const { upperHint, lowerHint } = await computeDefenseHints(
        publicClient,
        vault.address,
        config.troveManagerAddress,
        config.sortedTrovesAddress,
        musdRepay,
        btcTopup,
        logger as any,
      );

      // Simulate execution
      await publicClient.simulateContract({
        address: vault.address,
        abi: BallastVaultAbi,
        functionName: 'defend',
        args: [upperHint, lowerHint],
        account: walletClient.account,
      });

      // Send transaction
      const txHash = await (walletClient.writeContract as any)({
        address: vault.address,
        abi: BallastVaultAbi,
        functionName: 'defend',
        args: [upperHint, lowerHint],
        gas: 1200000n,
        account: walletClient.account,
      });

      logger?.info?.({ vault: vault.address, txHash }, 'Submitted defend() transaction, awaiting confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60000,
      });

      if (receipt.status === 'success') {
        defensesSucceeded++;
        circuitBreaker.recordSuccess();
        cooldownTracker.recordAction(vault.address);

        // Parse Defended event
        const parsedLogs = parseEventLogs({
          abi: BallastVaultAbi,
          eventName: 'Defended',
          logs: receipt.logs,
        });

        const newIcr = parsedLogs.length > 0 ? (parsedLogs[0].args as any).newICR : currentIcr;

        const defenseRecord: DefenseRecord = {
          vault: vault.address,
          txHash,
          keeper: walletClient.account.address,
          blockNumber: Number(receipt.blockNumber),
          musdRepaid: musdRepay.toString(),
          btcAdded: btcTopup.toString(),
          musdTip: profit.expectedTipMusd.toString(),
          btcTip: profit.expectedTipBtc.toString(),
          oldIcr: currentIcr.toString(),
          newIcr: newIcr.toString(),
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };

        await store.saveDefense(defenseRecord);

        // Emit defense executed alert
        await alertEvaluator.emitDefenseExecutedAlert({
          vault: vault.address,
          oldIcr: currentIcr,
          newIcr,
          musdRepaid: musdRepay,
          btcAdded: btcTopup,
          musdTip: profit.expectedTipMusd,
          btcTip: profit.expectedTipBtc,
          remainingMusd: 0n,
          remainingBtc: 0n,
          txHash,
        });
        notificationsQueued++;
      } else {
        defensesFailed++;
        circuitBreaker.recordFailure();
        await alertEvaluator.emitDefenseFailedAlert({
          vault: vault.address,
          currentIcr,
          triggerIcrPercent: Number((triggerIcr * 10000n) / PRECISION) / 100,
          reason: `Transaction reverted on-chain (${txHash})`,
        });
      }
    } catch (err: any) {
      defensesFailed++;
      circuitBreaker.recordFailure();
      logger?.error?.({ err, vault: vault.address }, 'Error executing defend() on vault');
      await alertEvaluator.emitDefenseFailedAlert({
        vault: vault.address,
        currentIcr,
        triggerIcrPercent: Number((triggerIcr * 10000n) / PRECISION) / 100,
        reason: err.message || 'Execution simulation failed',
      });
    }
  }

  return {
    success: defensesFailed === 0,
    fromBlock: discovery.fromBlock,
    toBlock: discovery.toBlock,
    newVaultsDiscovered: discovery.newVaultsCount,
    totalVaultsTracked: discovery.totalVaultsCount,
    vaultsEvaluated: vaults.length,
    defensesAttempted,
    defensesSucceeded,
    defensesFailed,
    notificationsQueued,
    circuitBreakerTripped: circuitBreaker.checkTripped(),
  };
}
