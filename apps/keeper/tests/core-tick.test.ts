import { describe, it, expect, beforeEach } from 'vitest';
import type { Address, PublicClient } from 'viem';
import { runKeeperTick } from '../src/core/tick.js';
import { KeeperDatabase } from '../src/db.js';
import { CircuitBreaker } from '../src/core/circuit-breaker.js';
import { CooldownTracker } from '../src/core/cooldown.js';
import type { CoreConfig } from '../src/core/types.js';

describe('Core Tick Execution Logic Unit Tests', () => {
  let db: KeeperDatabase;
  const vault = '0x1111111111111111111111111111111111111111' as Address;
  const owner = '0x2222222222222222222222222222222222222222' as Address;

  const mockConfig: CoreConfig = {
    factoryAddress: '0x8d5b392839300b487addeecc35f5bc534111cd33',
    troveManagerAddress: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0',
    priceFeedAddress: '0x86bCF0841622a5dAC14A313a15f96A95421b9366',
    sortedTrovesAddress: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA',
    deployBlockNumber: 100,
    chunkSize: 1000,
    confirmationDepth: 6,
    minProfitMargin: 0.10,
    vaultCooldownMs: 60000,
    circuitBreakerMaxFailures: 3,
    altruistic: true,
    dryRun: true,
  };

  beforeEach(() => {
    db = new KeeperDatabase(':memory:');
  });

  it('exits early without network calls when circuit breaker is tripped', async () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.checkTripped()).toBe(true);

    const mockClient = {} as PublicClient;

    const result = await runKeeperTick({
      publicClient: mockClient,
      store: db,
      config: mockConfig,
      circuitBreaker: cb,
    });

    expect(result.success).toBe(false);
    expect(result.circuitBreakerTripped).toBe(true);
    expect(result.error).toContain('Circuit breaker is tripped');
  });

  it('runs tick smoothly when no vaults exist yet', async () => {
    const mockClient = {
      getBlockNumber: async () => 110n,
      getLogs: async () => [],
    } as any;

    const result = await runKeeperTick({
      publicClient: mockClient,
      store: db,
      config: mockConfig,
    });

    expect(result.success).toBe(true);
    expect(result.newVaultsDiscovered).toBe(0);
    expect(result.totalVaultsTracked).toBe(0);
  });
});
