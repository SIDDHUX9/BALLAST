// @ts-nocheck
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  MATSNET_PROTOCOL_ADDRESSES,
  MATSNET_CHAIN_ID,
  MATSNET_FACTORY_DEPLOY_BLOCK,
} from "@ballast/shared";
import { runKeeperTick } from "../apps/keeper/src/core/tick.js";
import { ConvexTickStore } from "./store.js";

// Safe fallback deploy block from deployments/matsnet.json
const DEFAULT_DEPLOY_BLOCK = MATSNET_FACTORY_DEPLOY_BLOCK || 16251639;

// Maximum blocks scanned per tick to respect time and I/O budgets
const MAX_BLOCKS_PER_TICK = 2000;
// Time budget per tick in milliseconds (action timeout is 10 min, we keep each tick <= 25s)
const MAX_TICK_DURATION_MS = 25000;
// Default lease duration: 45 seconds (allows 30s cron cadence with 15s grace)
const LEASE_DURATION_MS = 45000;

/**
 * Atomic Compare-and-Set Mutation:
 * Checks if another keeper instance currently holds an active lease.
 * If expired or unheld, acquires lease for this worker and returns full state.
 */
export const acquireLeaseAndGetState = internalMutation({
  args: {
    workerId: v.string(),
    now: v.number(),
    leaseDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leaseDuration = args.leaseDurationMs ?? LEASE_DURATION_MS;
    let state = await ctx.db.query("keeperState").first();

    if (!state) {
      // Initialize singleton state
      const id = await ctx.db.insert("keeperState", {
        cursorBlock: DEFAULT_DEPLOY_BLOCK,
        lastIndexedAt: args.now,
        circuitBreakerTripped: false,
        consecutiveFailures: 0,
        lastSuccessTime: args.now,
        lastTickTime: args.now,
        leaseHolder: args.workerId,
        leaseExpiresAt: args.now + leaseDuration,
      });
      state = (await ctx.db.get(id))!;
    } else {
      // Lease check: If leased to someone else and not expired, exit immediately
      if (
        state.leaseHolder &&
        state.leaseHolder !== args.workerId &&
        state.leaseExpiresAt &&
        state.leaseExpiresAt > args.now
      ) {
        return { acquired: false, state: null, vaults: [], alertStates: [], telegramUsers: [] };
      }

      // Acquire or renew lease
      await ctx.db.patch(state._id, {
        leaseHolder: args.workerId,
        leaseExpiresAt: args.now + leaseDuration,
        lastTickTime: args.now,
      });
      state = (await ctx.db.get(state._id))!;
    }

    // Pre-fetch all tracked vaults and alert states so tick runs in-memory without extra DB queries
    const vaults = await ctx.db.query("vaults").collect();
    const alertStates = await ctx.db.query("alertStates").collect();
    const telegramUsers = await ctx.db.query("telegramUsers").collect();

    return {
      acquired: true,
      state,
      vaults,
      alertStates,
      telegramUsers,
    };
  },
});

/**
 * Commits the tick batch results, updates the cursor, schedules queued notifications,
 * and atomically releases the lease.
 */
export const commitTickResult = internalMutation({
  args: {
    workerId: v.string(),
    cursorBlock: v.number(),
    newVaults: v.array(
      v.object({
        address: v.string(),
        owner: v.string(),
        createdBlock: v.number(),
        txHash: v.string(),
        discoveredAt: v.string(),
      })
    ),
    newSnapshots: v.array(
      v.object({
        vault: v.string(),
        icr: v.string(),
        blockNumber: v.number(),
        timestamp: v.number(),
      })
    ),
    newDefenses: v.array(
      v.object({
        vault: v.string(),
        txHash: v.string(),
        keeper: v.string(),
        blockNumber: v.number(),
        musdRepaid: v.string(),
        btcAdded: v.string(),
        musdTip: v.string(),
        btcTip: v.string(),
        oldIcr: v.string(),
        newIcr: v.string(),
        gasUsed: v.optional(v.string()),
        effectiveGasPrice: v.optional(v.string()),
        status: v.string(),
        createdAt: v.string(),
        timestamp: v.number(),
        error: v.optional(v.string()),
      })
    ),
    alertStateUpdates: v.array(
      v.object({
        id: v.string(),
        vault: v.string(),
        alertType: v.string(),
        armed: v.boolean(),
        lastValue: v.optional(v.union(v.string(), v.null())),
        lastSentAt: v.number(),
      })
    ),
    queuedNotifications: v.array(
      v.object({
        idempotencyKey: v.string(),
        chatId: v.string(),
        message: v.string(),
      })
    ),
    circuitBreakerTripped: v.boolean(),
    consecutiveFailures: v.number(),
    circuitBreakerReason: v.optional(v.string()),
    pendingTxHash: v.optional(v.string()),
    pendingTxVault: v.optional(v.string()),
    pendingTxSubmittedAt: v.optional(v.number()),
    tickDurationMs: v.number(),
    now: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db.query("keeperState").first();
    if (!state) return;

    // 1. Insert newly discovered vaults
    for (const vlt of args.newVaults) {
      const existing = await ctx.db
        .query("vaults")
        .withIndex("by_address", (q) => q.eq("address", vlt.address.toLowerCase()))
        .first();
      if (!existing) {
        await ctx.db.insert("vaults", {
          address: vlt.address.toLowerCase(),
          owner: vlt.owner.toLowerCase(),
          createdBlock: vlt.createdBlock,
          txHash: vlt.txHash,
          discoveredAt: vlt.discoveredAt,
        });
      }
    }

    // 2. Insert ICR snapshots (capped/pruned)
    for (const snap of args.newSnapshots) {
      await ctx.db.insert("snapshots", {
        vault: snap.vault.toLowerCase(),
        icr: snap.icr,
        blockNumber: snap.blockNumber,
        timestamp: snap.timestamp,
      });
    }

    // 3. Insert defense records
    for (const def of args.newDefenses) {
      await ctx.db.insert("defenses", {
        vault: def.vault.toLowerCase(),
        txHash: def.txHash,
        keeper: def.keeper.toLowerCase(),
        blockNumber: def.blockNumber,
        musdRepaid: def.musdRepaid,
        btcAdded: def.btcAdded,
        musdTip: def.musdTip,
        btcTip: def.btcTip,
        oldIcr: def.oldIcr,
        newIcr: def.newIcr,
        gasUsed: def.gasUsed,
        effectiveGasPrice: def.effectiveGasPrice,
        status: def.status,
        createdAt: def.createdAt,
        timestamp: def.timestamp,
        error: def.error,
      });
    }

    // 4. Upsert alert states
    for (const alert of args.alertStateUpdates) {
      const key = alert.id.toLowerCase();
      const existing = await ctx.db
        .query("alertStates")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          armed: alert.armed,
          lastVal: alert.lastValue ?? undefined,
          lastSentAt: alert.lastSentAt,
        });
      } else {
        await ctx.db.insert("alertStates", {
          key,
          vault: alert.vault.toLowerCase(),
          alertType: alert.alertType,
          armed: alert.armed,
          lastVal: alert.lastValue ?? undefined,
          lastSentAt: alert.lastSentAt,
        });
      }
    }

    // 5. Enqueue notifications & schedule background delivery
    for (const notif of args.queuedNotifications) {
      const existing = await ctx.db
        .query("notificationOutbox")
        .withIndex("by_idempotency_key", (q) =>
          q.eq("idempotencyKey", notif.idempotencyKey)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("notificationOutbox", {
          idempotencyKey: notif.idempotencyKey,
          chatId: notif.chatId,
          message: notif.message,
          status: "pending",
          attempts: 0,
          maxAttempts: 5,
          nextRetryAt: 0,
          createdAt: new Date().toISOString(),
        });

        // Trigger asynchronous delivery with exponential backoff
        await ctx.scheduler.runAfter(0, internal.telegram.deliverNotification, {
          idempotencyKey: notif.idempotencyKey,
        });
      }
    }

    // 6. Update keeper singleton state and release lease
    await ctx.db.patch(state._id, {
      cursorBlock: args.cursorBlock,
      lastIndexedAt: args.now,
      circuitBreakerTripped: args.circuitBreakerTripped,
      consecutiveFailures: args.consecutiveFailures,
      circuitBreakerReason: args.circuitBreakerReason,
      lastSuccessTime: args.now,
      lastTickDurationMs: args.tickDurationMs,
      pendingTxHash: args.pendingTxHash,
      pendingTxVault: args.pendingTxVault,
      pendingTxSubmittedAt: args.pendingTxSubmittedAt,
      // Release lease
      leaseHolder: undefined,
      leaseExpiresAt: undefined,
    });
  },
});

/**
 * Releases lease immediately in case of abort or unhandled exception.
 */
export const releaseLease = internalMutation({
  args: {
    workerId: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db.query("keeperState").first();
    if (state && state.leaseHolder === args.workerId) {
      await ctx.db.patch(state._id, {
        leaseHolder: undefined,
        leaseExpiresAt: undefined,
      });
    }

    if (args.error) {
      await ctx.db.insert("errors", {
        type: "TICK_ABORT",
        message: args.error,
        timestamp: Date.now(),
      });
    }
  },
});

/**
 * Prunes rolling window snapshots, old error logs, and expired link tokens.
 * Run hourly via crons.ts to keep database size tiny and strictly under 500 MB.
 */
export const pruneOldData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

    // Prune snapshots older than 24 hours
    const oldSnapshots = await ctx.db
      .query("snapshots")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", Math.floor(cutoff24h / 1000)))
      .take(500);
    for (const snap of oldSnapshots) {
      await ctx.db.delete(snap._id);
    }

    // Prune errors older than 7 days
    const oldErrors = await ctx.db
      .query("errors")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff7d))
      .take(100);
    for (const err of oldErrors) {
      await ctx.db.delete(err._id);
    }

    // Prune expired link tokens older than 24 hours
    const expiredTokens = await ctx.db
      .query("linkTokens")
      .withIndex("by_expires", (q) => q.lt("expiresAt", cutoff24h))
      .take(100);
    for (const tok of expiredTokens) {
      await ctx.db.delete(tok._id);
    }
  },
});

/**
 * Health check query for GET /healthz and UI status indicator.
 */
export const getHealth = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("keeperState").first();
    const vaults = await ctx.db.query("vaults").collect();
    const now = Date.now();

    if (!state) {
      return {
        healthy: false,
        lastSuccessAgeSec: -1,
        vaultCount: 0,
        breakerTripped: false,
        cursorBlock: 0,
        pendingTx: null,
      };
    }

    const lastSuccessAgeSec = Math.floor((now - state.lastSuccessTime) / 1000);
    const isHealthy = !state.circuitBreakerTripped && lastSuccessAgeSec < 300;

    return {
      healthy: isHealthy,
      lastSuccessAgeSec,
      vaultCount: vaults.length,
      breakerTripped: state.circuitBreakerTripped,
      circuitBreakerReason: state.circuitBreakerReason ?? null,
      cursorBlock: state.cursorBlock,
      pendingTx: state.pendingTxHash ?? null,
    };
  },
});

/**
 * Public query for recent defenses.
 */
export const getDefenses = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("defenses").order("desc").take(limit);
  },
});

/**
 * Public query for tracked vaults.
 */
export const getVaults = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vaults").collect();
  },
});

/**
 * The core keeper monitor tick action.
 * Marked 'use node' to enable RPC calls, crypto, and wallet signing.
 * Scheduled via crons.interval('monitor', { seconds: 30 }, internal.keeper.tick, {}).
 */
export const tick = internalAction({
  args: {},
  handler: async (ctx) => {
    "use node";
    const workerId = `convex-worker-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // 1. Acquire Lease atomically via compare-and-set mutation
    const leaseRes = await ctx.runMutation(internal.keeper.acquireLeaseAndGetState, {
      workerId,
      now,
      leaseDurationMs: LEASE_DURATION_MS,
    });

    if (!leaseRes.acquired || !leaseRes.state) {
      // Overlapping tick detected or another worker is actively running
      return { skipped: true, reason: "Lease held by another worker" };
    }

    const { state, vaults, alertStates, telegramUsers } = leaseRes;

    // 2. Initialize In-Memory Store Adapter
    const store = new ConvexTickStore({
      initialCursor: state.cursorBlock,
      existingVaults: vaults as any,
      existingAlertStates: alertStates.map((a: any) => ({
        id: a.key,
        vault: a.vault as Address,
        alertType: a.alertType,
        armed: a.armed,
        lastValue: a.lastVal ?? null,
        lastSentAt: a.lastSentAt,
      })),
      existingTelegramUsers: telegramUsers.map((u: any) => ({
        chatId: u.chatId,
        address: u.address as Address,
        watchPercent: u.watchPercent ?? null,
        mutedUntil: u.mutedUntil,
        createdAt: u.createdAt,
      })),
    });

    // 3. Configure RPC Clients with Failover
    const primaryRpc = process.env.RPC_URL || "https://rpc.test.mezo.org";
    const fallbackRpc = process.env.RPC_URL_FALLBACK;
    const transports = [http(primaryRpc)];
    if (fallbackRpc) transports.push(http(fallbackRpc));

    const chain = {
      id: MATSNET_CHAIN_ID,
      name: "Mezo Testnet",
      nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
      rpcUrls: { default: { http: [primaryRpc] } },
      contracts: {
        multicall3: {
          address: "0xca11bde05977b3631167028862be2a173976ca11",
          blockCreated: 0,
        },
      },
    };

    const publicClient = createPublicClient({
      chain,
      transport: fallback(transports),
    });

    // 4. Configure Wallet Client if Private Key is present and not dry-run
    const privateKey = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
    const isDryRun = process.env.DRY_RUN === "true" || !privateKey;
    const isAltruistic = process.env.ALTRUISTIC === "true";

    let walletClient: any = undefined;
    if (privateKey && !isDryRun) {
      try {
        const account = privateKeyToAccount(privateKey);
        walletClient = createWalletClient({
          account,
          chain,
          transport: fallback(transports),
        });
      } catch (err) {
        console.error("Invalid KEEPER_PRIVATE_KEY format, proceeding in dry-run mode:", err);
      }
    }

    // 5. Check Pending Transaction from Previous Tick
    let pendingTxHash = state.pendingTxHash as Hex | undefined;
    let pendingTxVault = state.pendingTxVault as Address | undefined;
    let pendingTxSubmittedAt = state.pendingTxSubmittedAt;

    if (pendingTxHash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: pendingTxHash });
        if (receipt) {
          // Transaction confirmed! Clear pendingTx and record defense
          if (receipt.status === "success") {
            store.saveDefense({
              vault: pendingTxVault || ("0x0" as Address),
              txHash: pendingTxHash,
              keeper: walletClient?.account?.address || ("0x0" as Address),
              blockNumber: Number(receipt.blockNumber),
              musdRepaid: "0",
              btcAdded: "0",
              musdTip: "0",
              btcTip: "0",
              oldIcr: "0",
              newIcr: "0",
              gasUsed: receipt.gasUsed.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
              status: "confirmed",
              createdAt: new Date().toISOString(),
            });
          }
          pendingTxHash = undefined;
          pendingTxVault = undefined;
          pendingTxSubmittedAt = undefined;
        } else if (pendingTxSubmittedAt && now - pendingTxSubmittedAt > 180000) {
          // Timed out after 3 minutes
          pendingTxHash = undefined;
          pendingTxVault = undefined;
          pendingTxSubmittedAt = undefined;
        }
      } catch {
        // Receipt not yet available, keep checking next tick
      }
    }

    // 6. Execute Core Tick Cycle
    const startTime = Date.now();
    try {
      const result = await runKeeperTick({
        publicClient,
        walletClient,
        store,
        config: {
          factoryAddress:
            (process.env.FACTORY_ADDRESS as Address) ||
            MATSNET_PROTOCOL_ADDRESSES.factory,
          troveManagerAddress: MATSNET_PROTOCOL_ADDRESSES.troveManager,
          priceFeedAddress: MATSNET_PROTOCOL_ADDRESSES.priceFeed,
          sortedTrovesAddress: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
          deployBlockNumber: state.cursorBlock || DEFAULT_DEPLOY_BLOCK,
          chunkSize: 1000,
          confirmationDepth: 1,
          minProfitMargin: 1.15,
          vaultCooldownMs: 120000,
          circuitBreakerMaxFailures: 3,
          altruistic: isAltruistic,
          dryRun: isDryRun,
          maxBlocksPerTick: MAX_BLOCKS_PER_TICK,
          maxTickDurationMs: MAX_TICK_DURATION_MS,
        },
      });

      const batch = store.getBatch();
      const tickDurationMs = Date.now() - startTime;

      // 7. Commit Batch and Release Lease in a Single Atomic Mutation
      await ctx.runMutation(internal.keeper.commitTickResult, {
        workerId,
        cursorBlock: result.toBlock > 0 ? result.toBlock : state.cursorBlock,
        newVaults: batch.newVaults.map((v) => ({
          address: v.address,
          owner: v.owner,
          createdBlock: v.createdBlock,
          txHash: v.txHash,
          discoveredAt: v.discoveredAt,
        })),
        newSnapshots: batch.newSnapshots.map((s) => ({
          vault: s.vault,
          icr: s.icr,
          blockNumber: s.blockNumber,
          timestamp: s.timestamp,
        })),
        newDefenses: batch.newDefenses.map((d) => ({
          vault: d.vault,
          txHash: d.txHash,
          keeper: d.keeper,
          blockNumber: d.blockNumber,
          musdRepaid: d.musdRepaid,
          btcAdded: d.btcAdded,
          musdTip: d.musdTip,
          btcTip: d.btcTip,
          oldIcr: d.oldIcr,
          newIcr: d.newIcr,
          gasUsed: d.gasUsed,
          effectiveGasPrice: d.effectiveGasPrice,
          status: d.status,
          createdAt: d.createdAt,
          timestamp: Math.floor(Date.now() / 1000),
          error: d.error,
        })),
        alertStateUpdates: batch.alertStateUpdates.map((a) => ({
          id: a.id,
          vault: a.vault,
          alertType: a.alertType,
          armed: a.armed,
          lastValue: a.lastValue ?? null,
          lastSentAt: a.lastSentAt,
        })),
        queuedNotifications: batch.queuedNotifications,
        circuitBreakerTripped: result.circuitBreakerTripped,
        consecutiveFailures: result.circuitBreakerTripped ? state.consecutiveFailures + 1 : 0,
        circuitBreakerReason: result.error,
        pendingTxHash: result.pendingTxHash || pendingTxHash,
        pendingTxVault,
        pendingTxSubmittedAt,
        tickDurationMs,
        now: Date.now(),
        error: result.error,
      });

      return {
        success: result.success,
        defensesAttempted: result.defensesAttempted,
        defensesSucceeded: result.defensesSucceeded,
        newVaultsDiscovered: result.newVaultsDiscovered,
        tickDurationMs,
      };
    } catch (err: any) {
      console.error("Fatal error during keeper tick execution:", err);
      await ctx.runMutation(internal.keeper.releaseLease, {
        workerId,
        error: err.message || String(err),
      });
      return { success: false, error: err.message };
    }
  },
});

/**
 * Public Query: Reads keeper defenses for a specific vault from Convex audit trail.
 */
export const getDefensesByVault = query({
  args: { vault: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("defenses")
      .withIndex("by_vault", (q) => q.eq("vault", args.vault.toLowerCase()))
      .order("desc")
      .take(50);
  },
});

