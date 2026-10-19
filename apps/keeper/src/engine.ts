import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  parseEventLogs,
  parseEther,
  formatEther,
} from 'viem';
import type { Logger } from 'pino';
import { BallastVaultAbi } from '@ballast/shared';
import type { KeeperDatabase } from './db.js';
import type { RuntimeConfig } from './config.js';
import type { KeeperMetrics } from './metrics.js';
import type { ResilientRpcManager } from './rpc.js';
import { VaultDiscoveryService } from './discovery.js';
import { EarlyWarningService } from './signals.js';
import { computeDefenseHints } from './hints.js';
import {
  calculateProfitability,
  CooldownTracker,
  CircuitBreaker,
} from './defense-logic.js';
import type { CheckDefenseOutput, DefenseRecord, VaultRule } from './types.js';

export interface KeeperEngineState {
  isRunning: boolean;
  isShuttingDown: boolean;
  inFlightTxsCount: number;
  lastCycleTimestamp: string | null;
  lastSuccessfulCycle: string | null;
  consecutiveFailures: number;
  circuitBreakerTripped: boolean;
  activeRpcUrl: string;
}

export class KeeperEngine {
  private config: RuntimeConfig;
  private db: KeeperDatabase;
  private metrics: KeeperMetrics;
  private rpcManager: ResilientRpcManager;
  private discoveryService: VaultDiscoveryService;
  public earlyWarningService: EarlyWarningService;
  public cooldownTracker: CooldownTracker;
  public circuitBreaker: CircuitBreaker;
  private logger: Logger;

  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  private inFlightTxsCount: number = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastCycleTimestamp: string | null = null;
  private lastSuccessfulCycle: string | null = null;
  private keeperAddress?: Address;

  constructor(
    config: RuntimeConfig,
    db: KeeperDatabase,
    metrics: KeeperMetrics,
    rpcManager: ResilientRpcManager,
    logger: Logger,
  ) {
    this.config = config;
    this.db = db;
    this.metrics = metrics;
    this.rpcManager = rpcManager;
    this.logger = logger;

    this.discoveryService = new VaultDiscoveryService(
      this.rpcManager.getPublicClient(),
      this.db,
      {
        factoryAddress: this.config.factoryAddress,
        deployBlockNumber: this.config.deployBlockNumber,
        chunkSize: this.config.chunkSize,
        confirmationDepth: this.config.confirmationDepth,
      },
      this.logger,
    );

    this.earlyWarningService = new EarlyWarningService(this.db);
    this.cooldownTracker = new CooldownTracker(this.config.vaultCooldownMs);
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreakerMaxFailures);

    if (!this.config.dryRun) {
      try {
        const wallet = this.rpcManager.getWalletClient();
        this.keeperAddress = wallet.account?.address;
      } catch {
        // Dry-run or test without wallet
      }
    }
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.isShuttingDown = false;

    this.logger.info(
      {
        chainId: this.config.chainId,
        factory: this.config.factoryAddress,
        dryRun: this.config.dryRun,
        altruistic: this.config.altruistic,
        pollIntervalMs: this.config.pollIntervalMs,
      },
      'Starting Ballast defense keeper engine',
    );

    // Initial sync and cycle
    await this.runCycle();

    // Schedule regular monitor loop
    this.pollTimer = setInterval(async () => {
      if (this.isRunning && !this.isShuttingDown) {
        await this.runCycle();
      }
    }, this.config.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.info('Shutting down keeper engine, finishing in-flight transactions...');

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for any in-flight txs up to 30 seconds
    const startWait = Date.now();
    while (this.inFlightTxsCount > 0 && Date.now() - startWait < 30000) {
      await new Promise((r) => setTimeout(r, 500));
    }

    this.isRunning = false;
    this.logger.info('Keeper engine stopped cleanly.');
  }

  public getState(): KeeperEngineState {
    return {
      isRunning: this.isRunning,
      isShuttingDown: this.isShuttingDown,
      inFlightTxsCount: this.inFlightTxsCount,
      lastCycleTimestamp: this.lastCycleTimestamp,
      lastSuccessfulCycle: this.lastSuccessfulCycle,
      consecutiveFailures: this.circuitBreaker.getFailuresCount(),
      circuitBreakerTripped: this.circuitBreaker.checkTripped(),
      activeRpcUrl: this.rpcManager.getActiveRpcUrl(),
    };
  }

  public async runCycle(): Promise<void> {
    const cycleStart = Date.now();
    this.lastCycleTimestamp = new Date().toISOString();

    try {
      const publicClient = this.rpcManager.getPublicClient();

      // 1. RPC Health & Block Check
      const blockNumber = await publicClient.getBlockNumber();
      this.metrics.setLastBlock(Number(blockNumber));

      // 2. Check Keeper Wallet Balance
      if (this.keeperAddress) {
        const balanceWei = await publicClient.getBalance({ address: this.keeperAddress });
        const balanceBtc = Number(formatEther(balanceWei));
        this.metrics.setBalanceBtc(balanceBtc);

        const thresholdBtc = Number(this.config.lowBalanceThresholdBtc);
        if (balanceBtc < thresholdBtc) {
          this.logger.warn(
            { balanceBtc, thresholdBtc },
            'Keeper wallet balance is below threshold',
          );
        }
      }

      // 3. Vault Discovery Step
      try {
        const { totalVaultsCount, newVaultsCount } = await this.discoveryService.sync();
        this.metrics.setVaultsTracked(totalVaultsCount);
        if (newVaultsCount > 0) {
          this.logger.info({ newVaultsCount, totalVaultsCount }, 'Vault discovery updated');
        }
      } catch (discErr) {
        this.logger.warn({ discErr }, 'Vault discovery encountered error, proceeding with known vaults');
      }

      // 4. Load all tracked vaults
      const trackedVaults = this.db.getAllVaults();
      if (trackedVaults.length === 0) {
        this.logger.debug('No vaults currently tracked');
        this.recordCycleLatency(cycleStart);
        return;
      }

      // 5. Multicall checkDefense() across all tracked vaults
      const multicallContracts = trackedVaults.map((v) => ({
        address: v.address,
        abi: BallastVaultAbi,
        functionName: 'checkDefense' as const,
      }));

      const results = await publicClient.multicall({
        contracts: multicallContracts,
        allowFailure: true,
      });

      const defendableVaults: CheckDefenseOutput[] = [];

      for (let i = 0; i < trackedVaults.length; i++) {
        const vaultAddr = trackedVaults[i].address;
        const res = results[i];

        if (res.status === 'success' && res.result) {
          const [defendable, currentICR, musdToRepay, btcToAdd] = res.result as [
            boolean,
            bigint,
            bigint,
            bigint,
          ];

          // 6. Record Early Warning Signal
          this.earlyWarningService.recordSnapshot(
            vaultAddr,
            currentICR,
            Number(blockNumber),
          );

          if (defendable) {
            defendableVaults.push({
              vault: vaultAddr,
              defendable,
              currentICR,
              musdToRepay,
              btcToAdd,
            });
          }
        }
      }

      this.logger.debug(
        { trackedCount: trackedVaults.length, defendableCount: defendableVaults.length },
        'Multicall checkDefense completed',
      );

      // 7. Process Defendable Vaults
      for (const item of defendableVaults) {
        if (this.isShuttingDown) break;

        await this.processDefense(item, Number(blockNumber));
      }

      this.lastSuccessfulCycle = new Date().toISOString();
    } catch (err) {
      this.logger.error({ err }, 'Unhandled error in keeper monitor loop cycle');
      this.metrics.incrementGeneralFailure();
    } finally {
      this.recordCycleLatency(cycleStart);
    }
  }

  private async processDefense(item: CheckDefenseOutput, currentBlock: number): Promise<void> {
    const vault = item.vault;

    // Check Cooldown
    if (this.cooldownTracker.isCoolingDown(vault)) {
      this.logger.debug(
        { vault, remainingMs: this.cooldownTracker.getRemainingCooldownMs(vault) },
        'Skipping defense: vault is in cooldown',
      );
      return;
    }

    // Check Circuit Breaker
    if (this.circuitBreaker.checkTripped()) {
      this.logger.warn({ vault }, 'Circuit breaker is TRIPPED! Pausing all defenses.');
      this.metrics.setCircuitBreaker(true);
      return;
    }

    const publicClient = this.rpcManager.getPublicClient();

    try {
      // 1. Fetch Oracle Price
      const btcPrice = (await publicClient.readContract({
        address: this.config.priceFeedAddress,
        abi: [
          {
            type: 'function',
            name: 'fetchPrice',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'fetchPrice',
      })) as bigint;

      // 2. Fetch Vault Rule for maxTipBps
      const ruleRes = (await publicClient.readContract({
        address: vault,
        abi: BallastVaultAbi,
        functionName: 'rule',
      })) as [boolean, bigint, bigint, number];

      const rule: VaultRule = {
        enabled: ruleRes[0],
        triggerICR: ruleRes[1],
        targetICR: ruleRes[2],
        maxTipBps: ruleRes[3],
      };

      // 3. Compute Off-Chain Hints
      const hints = await computeDefenseHints(
        publicClient,
        vault,
        this.config.troveManagerAddress,
        this.config.sortedTrovesAddress,
        item.musdToRepay,
        item.btcToAdd,
        this.logger,
      );

      // 4. Simulate defend() using eth_call
      this.logger.debug({ vault, hints }, 'Simulating defend() call');

      const simAccount = this.keeperAddress || '0x0000000000000000000000000000000000000001';
      let gasEstimate = 850000n; // safe default for Mezo
      try {
        const simResult = await publicClient.simulateContract({
          address: vault,
          abi: BallastVaultAbi,
          functionName: 'defend',
          args: [hints.upperHint, hints.lowerHint],
          account: simAccount,
        });

        const estGas = await publicClient.estimateContractGas({
          address: vault,
          abi: BallastVaultAbi,
          functionName: 'defend',
          args: [hints.upperHint, hints.lowerHint],
          account: simAccount,
        });
        gasEstimate = (estGas * 120n) / 100n; // 20% buffer
      } catch (simErr) {
        this.logger.warn({ vault, simErr }, 'Simulation of defend() failed; skipping');
        this.recordFailure(vault, 'Simulation reverted');
        return;
      }

      // 5. Gas Price & Profitability Check
      const gasPrice = await publicClient.getGasPrice();
      const profitResult = calculateProfitability({
        musdToRepay: item.musdToRepay,
        btcToAdd: item.btcToAdd,
        maxTipBps: rule.maxTipBps,
        btcPriceWei: btcPrice,
        estimatedGas: gasEstimate,
        gasPriceWei: gasPrice,
        minProfitMargin: this.config.minProfitMargin,
        altruistic: this.config.altruistic,
      });

      if (!profitResult.isProfitable) {
        this.logger.info(
          {
            vault,
            expectedTipUsd: profitResult.expectedTipUsd.toFixed(2),
            gasCostUsd: profitResult.estimatedGasCostUsd.toFixed(2),
            netProfitUsd: profitResult.netProfitUsd.toFixed(2),
          },
          'Defense skipped: not profitable at current gas price and tip',
        );
        return;
      }

      this.logger.info(
        {
          vault,
          tipUsd: profitResult.expectedTipUsd.toFixed(2),
          gasUsd: profitResult.estimatedGasCostUsd.toFixed(2),
          netUsd: profitResult.netProfitUsd.toFixed(2),
          altruistic: this.config.altruistic,
        },
        'Defense evaluated as viable',
      );

      // 6. Pre-flight Idempotency Check right before sending
      const preCheck = (await publicClient.readContract({
        address: vault,
        abi: BallastVaultAbi,
        functionName: 'checkDefense',
      })) as [boolean, bigint, bigint, bigint];

      if (!preCheck[0]) {
        this.logger.info({ vault }, 'Pre-flight check: vault already defended or state changed; skipping');
        return;
      }

      // 7. Dry-Run Mode Check
      if (this.config.dryRun) {
        this.logger.info(
          {
            vault,
            musdRepay: item.musdToRepay.toString(),
            btcToAdd: item.btcToAdd.toString(),
            upperHint: hints.upperHint,
            lowerHint: hints.lowerHint,
          },
          '[DRY-RUN] Defense simulation succeeded; skipping real broadcast',
        );

        this.db.saveDefense({
          vault,
          txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          keeper: simAccount,
          blockNumber: currentBlock,
          musdRepaid: item.musdToRepay.toString(),
          btcAdded: item.btcToAdd.toString(),
          musdTip: profitResult.expectedTipMusd.toString(),
          btcTip: profitResult.expectedTipBtc.toString(),
          oldIcr: item.currentICR.toString(),
          newIcr: '0',
          status: 'simulated',
          createdAt: new Date().toISOString(),
        });

        this.cooldownTracker.recordAction(vault);
        return;
      }

      // 8. Live Execution
      await this.executeLiveDefense(vault, hints, item, profitResult, gasEstimate, gasPrice, currentBlock);
    } catch (err) {
      this.logger.error({ vault, err }, 'Unexpected failure during defense processing');
      this.recordFailure(vault, String(err));
    }
  }

  private async executeLiveDefense(
    vault: Address,
    hints: { upperHint: Address; lowerHint: Address },
    item: CheckDefenseOutput,
    profitResult: ReturnType<typeof calculateProfitability>,
    gasEstimate: bigint,
    gasPrice: bigint,
    currentBlock: number,
  ): Promise<void> {
    const walletClient = this.rpcManager.getWalletClient();
    const publicClient = this.rpcManager.getPublicClient();
    const keeper = this.keeperAddress!;

    this.inFlightTxsCount++;
    this.metrics.incrementSent();

    try {
      // Nonce and gas fee cap
      const maxFeeWei = parseEther(this.config.maxFeePerGasGwei.toString(), 'gwei');
      const effectiveGasPrice = gasPrice > maxFeeWei ? maxFeeWei : gasPrice;

      this.logger.info(
        { vault, keeper, gasPriceGwei: formatEther(effectiveGasPrice, 'gwei') },
        'Broadcasting defend() transaction',
      );

      const txHash = await walletClient.writeContract({
        address: vault,
        abi: BallastVaultAbi,
        functionName: 'defend',
        args: [hints.upperHint, hints.lowerHint],
        gas: gasEstimate < 850000n ? 850000n : gasEstimate,
        gasPrice: effectiveGasPrice,
        chain: publicClient.chain,
        account: walletClient.account!,
      });

      this.logger.info({ txHash, vault }, 'Transaction submitted, awaiting confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60000,
      });

      if (receipt.status === 'success') {
        let oldIcrStr = item.currentICR.toString();
        let newIcrStr = '0';
        let musdRepaidStr = item.musdToRepay.toString();
        let btcAddedStr = item.btcToAdd.toString();
        let musdTipStr = profitResult.expectedTipMusd.toString();
        let btcTipStr = profitResult.expectedTipBtc.toString();

        // Parse Defended event log
        try {
          const logs = parseEventLogs({
            abi: BallastVaultAbi,
            eventName: 'Defended',
            logs: receipt.logs,
          });

          if (logs.length > 0) {
            const defLog = logs[0].args;
            musdRepaidStr = defLog.musdRepaid.toString();
            btcAddedStr = defLog.btcAdded.toString();
            musdTipStr = defLog.musdTip.toString();
            btcTipStr = defLog.btcTip.toString();
            oldIcrStr = defLog.oldICR.toString();
            newIcrStr = defLog.newICR.toString();
          }
        } catch {
          // fallback to calculated values
        }

        const defenseRecord: DefenseRecord = {
          vault,
          txHash,
          keeper,
          blockNumber: Number(receipt.blockNumber),
          musdRepaid: musdRepaidStr,
          btcAdded: btcAddedStr,
          musdTip: musdTipStr,
          btcTip: btcTipStr,
          oldIcr: oldIcrStr,
          newIcr: newIcrStr,
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };

        this.db.saveDefense(defenseRecord);
        this.cooldownTracker.recordAction(vault);
        this.circuitBreaker.recordSuccess();
        this.metrics.incrementSuccess();

        this.logger.info(
          {
            vault,
            txHash,
            blockNumber: Number(receipt.blockNumber),
            oldIcr: oldIcrStr,
            newIcr: newIcrStr,
            gasUsed: receipt.gasUsed.toString(),
          },
          'Defense transaction successfully confirmed!',
        );
      } else {
        throw new Error(`Transaction reverted on-chain with status ${receipt.status}`);
      }
    } catch (sendErr) {
      this.logger.error({ vault, sendErr }, 'Defense transaction execution failed');
      this.recordFailure(vault, String(sendErr));
    } finally {
      this.inFlightTxsCount--;
    }
  }

  private recordFailure(vault: Address, errorMsg: string): void {
    this.metrics.incrementDefenseFailure();
    const tripped = this.circuitBreaker.recordFailure();

    if (tripped) {
      this.metrics.setCircuitBreaker(true);
      this.logger.error(
        { consecutiveFailures: this.circuitBreaker.getFailuresCount() },
        'CRITICAL: Circuit breaker tripped due to consecutive failures. Defense execution paused!',
      );
    }
  }

  private recordCycleLatency(startTime: number): void {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    this.metrics.setLoopLatency(elapsedSeconds);
  }
}
