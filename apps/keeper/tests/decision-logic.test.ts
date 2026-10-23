import { describe, it, expect } from 'vitest';
import {
  calculateProfitability,
  CooldownTracker,
  CircuitBreaker,
} from '../src/defense-logic.js';
import { KeeperDatabase } from '../src/db.js';
import { EarlyWarningService } from '../src/signals.js';
import { KeeperMetrics } from '../src/metrics.js';
import { parseEther } from 'viem';

describe('Keeper Decision Logic Unit Tests', () => {
  describe('Profitability Calculation', () => {
    const btcPriceWei = 80000n * 10n ** 18n; // $80,000 / BTC
    const gasPriceWei = 2n * 10n ** 9n; // 2 gwei
    const estimatedGas = 800000n; // 800,000 gas
    // Gas cost = 800,000 * 2 gwei = 1.6e15 wei = 0.0016 BTC = $128.00

    it('returns isProfitable = true when tip exceeds gas cost + margin', () => {
      // Repay 50,000 MUSD with 50 bps tip (0.50%) = 250 MUSD = $250 tip
      // $250 > $128 * 1.10 ($140.80) -> Profitable!
      const result = calculateProfitability({
        musdToRepay: 50000n * 10n ** 18n,
        btcToAdd: 0n,
        maxTipBps: 50,
        btcPriceWei,
        estimatedGas,
        gasPriceWei,
        minProfitMargin: 0.10, // 10%
        altruistic: false,
      });

      expect(result.isProfitable).toBe(true);
      expect(result.expectedTipUsd).toBeCloseTo(250, 1);
      expect(result.estimatedGasCostUsd).toBeCloseTo(128, 1);
      expect(result.netProfitUsd).toBeGreaterThan(100);
    });

    it('returns isProfitable = false when tip is less than gas cost + margin', () => {
      // Repay 20,000 MUSD with 50 bps tip = 100 MUSD = $100 tip
      // $100 < $128 * 1.10 ($140.80) -> Unprofitable!
      const result = calculateProfitability({
        musdToRepay: 20000n * 10n ** 18n,
        btcToAdd: 0n,
        maxTipBps: 50,
        btcPriceWei,
        estimatedGas,
        gasPriceWei,
        minProfitMargin: 0.10,
        altruistic: false,
      });

      expect(result.isProfitable).toBe(false);
      expect(result.expectedTipUsd).toBeCloseTo(100, 1);
      expect(result.estimatedGasCostUsd).toBeCloseTo(128, 1);
      expect(result.netProfitUsd).toBeLessThan(0);
    });

    it('returns isProfitable = true when altruistic flag is enabled even if unprofitable', () => {
      // Small defense: 1,000 MUSD repay with 10 bps tip = 1 MUSD tip ($1)
      // Gas cost is $128 -> Massive loss, but altruistic mode overrides!
      const result = calculateProfitability({
        musdToRepay: 1000n * 10n ** 18n,
        btcToAdd: 0n,
        maxTipBps: 10,
        btcPriceWei,
        estimatedGas,
        gasPriceWei,
        minProfitMargin: 0.10,
        altruistic: true, // ALTRUISTIC
      });

      expect(result.isProfitable).toBe(true);
      expect(result.netProfitUsd).toBeLessThan(0);
    });

    it('calculates tip from native BTC addition correctly', () => {
      // Add 1 BTC collateral with 100 bps tip (1.00%) = 0.01 BTC = $800 tip
      const result = calculateProfitability({
        musdToRepay: 0n,
        btcToAdd: 1n * 10n ** 18n,
        maxTipBps: 100,
        btcPriceWei,
        estimatedGas,
        gasPriceWei,
        minProfitMargin: 0.20,
        altruistic: false,
      });

      expect(result.isProfitable).toBe(true);
      expect(result.expectedTipBtc).toBe(10n ** 16n); // 0.01 BTC
      expect(result.expectedTipUsd).toBeCloseTo(800, 1);
    });
  });

  describe('Cooldown Tracker with Injected Clock', () => {
    it('enforces cooldown period and expires correctly', () => {
      let currentTime = 1000000;
      const clock = () => currentTime;
      const tracker = new CooldownTracker(30000, clock); // 30s cooldown

      const vault = '0x1111111111111111111111111111111111111111';
      expect(tracker.isCoolingDown(vault)).toBe(false);

      // Record defense action
      tracker.recordAction(vault);
      expect(tracker.isCoolingDown(vault)).toBe(true);
      expect(tracker.getRemainingCooldownMs(vault)).toBe(30000);

      // Advance clock by 10 seconds
      currentTime += 10000;
      expect(tracker.isCoolingDown(vault)).toBe(true);
      expect(tracker.getRemainingCooldownMs(vault)).toBe(20000);

      // Advance clock past 30 seconds
      currentTime += 25000; // total 35s
      expect(tracker.isCoolingDown(vault)).toBe(false);
      expect(tracker.getRemainingCooldownMs(vault)).toBe(0);
    });

    it('isolates cooldown per vault', () => {
      let currentTime = 1000000;
      const tracker = new CooldownTracker(60000, () => currentTime);

      const vaultA = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const vaultB = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

      tracker.recordAction(vaultA);
      expect(tracker.isCoolingDown(vaultA)).toBe(true);
      expect(tracker.isCoolingDown(vaultB)).toBe(false);
    });
  });

  describe('Circuit Breaker', () => {
    it('trips after N consecutive failures and pauses execution', () => {
      const breaker = new CircuitBreaker(3); // Trip after 3 failures

      expect(breaker.checkTripped()).toBe(false);
      expect(breaker.getFailuresCount()).toBe(0);

      // Failure 1
      breaker.recordFailure();
      expect(breaker.checkTripped()).toBe(false);
      expect(breaker.getFailuresCount()).toBe(1);

      // Failure 2
      breaker.recordFailure();
      expect(breaker.checkTripped()).toBe(false);

      // Failure 3 -> Tripped!
      const tripped = breaker.recordFailure();
      expect(tripped).toBe(true);
      expect(breaker.checkTripped()).toBe(true);
      expect(breaker.getFailuresCount()).toBe(3);
    });

    it('resets consecutive failures counter upon success', () => {
      const breaker = new CircuitBreaker(3);

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getFailuresCount()).toBe(2);

      // Successful defense
      breaker.recordSuccess();
      expect(breaker.getFailuresCount()).toBe(0);
      expect(breaker.checkTripped()).toBe(false);
    });

    it('can be manually reset', () => {
      const breaker = new CircuitBreaker(2);
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.checkTripped()).toBe(true);

      breaker.reset();
      expect(breaker.checkTripped()).toBe(false);
      expect(breaker.getFailuresCount()).toBe(0);
    });
  });

  describe('SQLite Persistence & Early Warnings', () => {
    it('persists cursor and vaults in SQLite database', () => {
      const db = new KeeperDatabase(':memory:');

      // Test cursor
      expect(db.getCursor()).toBe(null);
      db.saveCursor(16251640);
      expect(db.getCursor()).toBe(16251640);

      // Test vault storage
      const vaultAddr = '0x1234567890123456789012345678901234567890';
      const ownerAddr = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      db.saveVault({
        address: vaultAddr,
        owner: ownerAddr,
        createdBlock: 16251639,
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        discoveredAt: new Date().toISOString(),
      });

      expect(db.getVaultCount()).toBe(1);
      const vaults = db.getAllVaults();
      expect(vaults.length).toBe(1);
      expect(vaults[0].address).toBe(vaultAddr.toLowerCase());

      db.close();
    });

    it('records and emits early warning snapshots with near-trigger alerts', () => {
      const db = new KeeperDatabase(':memory:');
      const earlyWarning = new EarlyWarningService(db);

      let emittedSnapshot: any = null;
      let emittedWarning: any = null;

      earlyWarning.on('icr_snapshot', (s) => {
        emittedSnapshot = s;
      });
      earlyWarning.on('warning_near_trigger', (w) => {
        emittedWarning = w;
      });

      const vault = '0x1234567890123456789012345678901234567890';
      const triggerIcr = 120n * 10n ** 16n; // 120% (1.20e18)
      // Current ICR is 125% -> Within 10% of 120% (120% * 1.10 = 132%)
      const currentIcr = 125n * 10n ** 16n; // 125%

      earlyWarning.recordSnapshot(vault, currentIcr, 1000, triggerIcr);

      expect(emittedSnapshot).not.toBeNull();
      expect(emittedSnapshot.vault).toBe(vault);
      expect(emittedSnapshot.icrPercent).toBe(125);
      expect(emittedSnapshot.isNearTrigger).toBe(true);

      expect(emittedWarning).not.toBeNull();
      expect(emittedWarning.vault).toBe(vault);

      const history = earlyWarning.getHistory(vault);
      expect(history.length).toBe(1);
      expect(history[0].icr).toBe(currentIcr.toString());

      db.close();
    });
  });

  describe('Observability: Prometheus Metrics & Healthz', () => {
    it('formats metrics in valid Prometheus exposition format', () => {
      const metrics = new KeeperMetrics();
      metrics.setVaultsTracked(42);
      metrics.incrementSent();
      metrics.incrementSuccess();
      metrics.setBalanceBtc(1.23456789);
      metrics.setLastBlock(16251700);
      metrics.setLoopLatency(0.452);

      const output = metrics.toPrometheusFormat();

      expect(output).toContain('keeper_vaults_tracked 42');
      expect(output).toContain('keeper_defenses_total{status="sent"} 1');
      expect(output).toContain('keeper_defenses_total{status="success"} 1');
      expect(output).toContain('keeper_balance_btc 1.23456789');
      expect(output).toContain('keeper_last_block_number 16251700');
      expect(output).toContain('keeper_circuit_breaker_status 0');
    });
  });
});
