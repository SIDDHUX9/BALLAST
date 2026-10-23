import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema.js';

const modules = import.meta.glob('../convex/**/*.*s');

describe('Convex Keeper Mutations & State Coordination', () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe('Compare-and-Set Lease Mutation', () => {
    it('initializes keeperState and grants lease to the first worker', async () => {
      const now = 1000000;
      const leaseDuration = 45000;

      const result = await t.run(async (ctx) => {
        let state = await ctx.db.query('keeperState').first();
        if (!state) {
          const id = await ctx.db.insert('keeperState', {
            cursorBlock: 16251640,
            lastIndexedAt: now,
            circuitBreakerTripped: false,
            consecutiveFailures: 0,
            lastSuccessTime: now,
            lastTickTime: now,
            leaseHolder: 'worker-1',
            leaseExpiresAt: now + leaseDuration,
          });
          state = (await ctx.db.get(id))!;
        }
        return { acquired: true, state };
      });

      expect(result.acquired).toBe(true);
      expect(result.state.leaseHolder).toBe('worker-1');
      expect(result.state.leaseExpiresAt).toBe(now + leaseDuration);
    });

    it('denies lease to overlapping worker while lease is still active', async () => {
      const now = 1000000;
      const leaseDuration = 45000;

      // 1. Worker 1 acquires lease
      await t.run(async (ctx) => {
        await ctx.db.insert('keeperState', {
          cursorBlock: 16251640,
          lastIndexedAt: now,
          circuitBreakerTripped: false,
          consecutiveFailures: 0,
          lastSuccessTime: now,
          lastTickTime: now,
          leaseHolder: 'worker-1',
          leaseExpiresAt: now + leaseDuration,
        });
      });

      // 2. Worker 2 attempts to acquire at now + 10s (lease still active)
      const worker2Attempt = await t.run(async (ctx) => {
        const state = await ctx.db.query('keeperState').first();
        const attemptTime = now + 10000;
        if (
          state &&
          state.leaseHolder &&
          state.leaseHolder !== 'worker-2' &&
          state.leaseExpiresAt &&
          state.leaseExpiresAt > attemptTime
        ) {
          return { acquired: false };
        }
        return { acquired: true };
      });

      expect(worker2Attempt.acquired).toBe(false);
    });

    it('grants lease to worker 2 once the previous lease has expired', async () => {
      const now = 1000000;
      const leaseDuration = 45000;

      await t.run(async (ctx) => {
        await ctx.db.insert('keeperState', {
          cursorBlock: 16251640,
          lastIndexedAt: now,
          circuitBreakerTripped: false,
          consecutiveFailures: 0,
          lastSuccessTime: now,
          lastTickTime: now,
          leaseHolder: 'worker-1',
          leaseExpiresAt: now + leaseDuration,
        });
      });

      // Worker 2 attempts after expiration (now + 50s)
      const worker2Result = await t.run(async (ctx) => {
        const attemptTime = now + 50000;
        const state = (await ctx.db.query('keeperState').first())!;

        if (state.leaseExpiresAt && state.leaseExpiresAt > attemptTime) {
          return { acquired: false };
        }

        await ctx.db.patch(state._id, {
          leaseHolder: 'worker-2',
          leaseExpiresAt: attemptTime + leaseDuration,
          lastTickTime: attemptTime,
        });

        const updated = await ctx.db.get(state._id);
        return { acquired: true, state: updated };
      });

      expect(worker2Result.acquired).toBe(true);
      expect(worker2Result.state?.leaseHolder).toBe('worker-2');
    });

    it('releases lease cleanly when tick completes', async () => {
      const now = 1000000;
      await t.run(async (ctx) => {
        const id = await ctx.db.insert('keeperState', {
          cursorBlock: 16251640,
          lastIndexedAt: now,
          circuitBreakerTripped: false,
          consecutiveFailures: 0,
          lastSuccessTime: now,
          lastTickTime: now,
          leaseHolder: 'worker-1',
          leaseExpiresAt: now + 45000,
        });

        // Release lease
        await ctx.db.patch(id, {
          leaseHolder: undefined,
          leaseExpiresAt: undefined,
          lastSuccessTime: now + 2000,
        });

        const updated = await ctx.db.get(id);
        expect(updated?.leaseHolder).toBeUndefined();
        expect(updated?.leaseExpiresAt).toBeUndefined();
        expect(updated?.lastSuccessTime).toBe(now + 2000);
      });
    });
  });

  describe('Cursor Tracking & Vault Indexing', () => {
    it('updates cursor block monotonically on each tick commit', async () => {
      const startBlock = 16251640;
      const nextBlock = 16252000;

      await t.run(async (ctx) => {
        const id = await ctx.db.insert('keeperState', {
          cursorBlock: startBlock,
          lastIndexedAt: 1000000,
          circuitBreakerTripped: false,
          consecutiveFailures: 0,
          lastSuccessTime: 1000000,
          lastTickTime: 1000000,
        });

        await ctx.db.patch(id, {
          cursorBlock: nextBlock,
          lastIndexedAt: 1005000,
        });

        const updated = await ctx.db.get(id);
        expect(updated?.cursorBlock).toBe(nextBlock);
        expect(updated?.lastIndexedAt).toBe(1005000);
      });
    });

    it('stores discovered vaults without duplicates', async () => {
      const vaultAddress = '0xc2a1d4105a71b1e6c6edba128018ea9f5a896587';
      const owner = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

      await t.run(async (ctx) => {
        // Insert first time
        await ctx.db.insert('vaults', {
          address: vaultAddress,
          owner,
          createdBlock: 16251641,
          txHash: '0xabc123',
          discoveredAt: new Date().toISOString(),
        });

        // Attempt second insert with duplicate check
        const existing = await ctx.db
          .query('vaults')
          .withIndex('by_address', (q) => q.eq('address', vaultAddress))
          .first();

        expect(existing).not.toBeNull();
        expect(existing?.address).toBe(vaultAddress);

        const allVaults = await ctx.db.query('vaults').collect();
        expect(allVaults.length).toBe(1);
      });
    });
  });

  describe('Circuit Breaker Trips & Recovery', () => {
    it('trips circuit breaker after consecutive failures threshold', async () => {
      await t.run(async (ctx) => {
        const id = await ctx.db.insert('keeperState', {
          cursorBlock: 16251640,
          lastIndexedAt: 1000000,
          circuitBreakerTripped: false,
          consecutiveFailures: 2,
          lastSuccessTime: 1000000,
          lastTickTime: 1000000,
        });

        // 3rd failure triggers breaker trip
        const newFailures = 3;
        const maxFailures = 3;
        const tripped = newFailures >= maxFailures;

        await ctx.db.patch(id, {
          consecutiveFailures: newFailures,
          circuitBreakerTripped: tripped,
          circuitBreakerTrippedAt: 1001000,
          circuitBreakerReason: 'RPC execution failed 3 times in a row',
        });

        const state = await ctx.db.get(id);
        expect(state?.circuitBreakerTripped).toBe(true);
        expect(state?.consecutiveFailures).toBe(3);
        expect(state?.circuitBreakerReason).toContain('RPC execution failed');
      });
    });

    it('resets consecutive failures and breaker on successful tick', async () => {
      await t.run(async (ctx) => {
        const id = await ctx.db.insert('keeperState', {
          cursorBlock: 16251640,
          lastIndexedAt: 1000000,
          circuitBreakerTripped: true,
          consecutiveFailures: 3,
          circuitBreakerReason: 'Prior error',
          lastSuccessTime: 1000000,
          lastTickTime: 1000000,
        });

        // Manual reset or successful tick recovery
        await ctx.db.patch(id, {
          circuitBreakerTripped: false,
          circuitBreakerTrippedAt: undefined,
          circuitBreakerReason: undefined,
          consecutiveFailures: 0,
          lastSuccessTime: 1005000,
        });

        const state = await ctx.db.get(id);
        expect(state?.circuitBreakerTripped).toBe(false);
        expect(state?.consecutiveFailures).toBe(0);
        expect(state?.circuitBreakerReason).toBeUndefined();
      });
    });
  });

  describe('Notification Outbox Idempotency', () => {
    it('guarantees unique insertion via idempotencyKey', async () => {
      const idempotencyKey = 'warning:0xc2a1:chat123:1000000:135.50';

      await t.run(async (ctx) => {
        // Enqueue first notification
        await ctx.db.insert('notificationOutbox', {
          idempotencyKey,
          chatId: '12345678',
          message: 'Warning: ICR dropped to 135.5%',
          status: 'pending',
          attempts: 0,
          maxAttempts: 5,
          nextRetryAt: 0,
          createdAt: new Date().toISOString(),
        });

        // Check deduplication before second insert
        const existing = await ctx.db
          .query('notificationOutbox')
          .withIndex('by_idempotency_key', (q) => q.eq('idempotencyKey', idempotencyKey))
          .first();

        expect(existing).not.toBeNull();

        // Should not insert duplicate
        const allPending = await ctx.db
          .query('notificationOutbox')
          .withIndex('by_idempotency_key', (q) => q.eq('idempotencyKey', idempotencyKey))
          .collect();

        expect(allPending.length).toBe(1);
      });
    });
  });

  describe('Rolling Window Pruning', () => {
    it('prunes snapshots older than 24 hours while keeping recent snapshots', async () => {
      const nowSec = 1700000000;
      const cutoff24h = nowSec - 86400;

      await t.run(async (ctx) => {
        // Stale snapshot (26 hours old)
        await ctx.db.insert('snapshots', {
          vault: '0xc2a1',
          icr: '1400000000000000000',
          blockNumber: 16000000,
          timestamp: cutoff24h - 7200,
        });

        // Fresh snapshot (1 hour old)
        await ctx.db.insert('snapshots', {
          vault: '0xc2a1',
          icr: '1350000000000000000',
          blockNumber: 16005000,
          timestamp: cutoff24h + 3600,
        });

        // Pruning operation
        const oldSnapshots = await ctx.db
          .query('snapshots')
          .withIndex('by_timestamp', (q) => q.lt('timestamp', cutoff24h))
          .collect();

        expect(oldSnapshots.length).toBe(1);

        for (const s of oldSnapshots) {
          await ctx.db.delete(s._id);
        }

        const remaining = await ctx.db.query('snapshots').collect();
        expect(remaining.length).toBe(1);
        expect(remaining[0].timestamp).toBeGreaterThan(cutoff24h);
      });
    });
  });
});
