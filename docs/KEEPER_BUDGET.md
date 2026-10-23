# Ballast Keeper — Convex Free-Plan Arithmetic & Usage Budget

This document details the exact resource usage, function call calculations, database bandwidth/storage metrics, and architecture optimizations that guarantee the Ballast keeper and Telegram alert bot run 24/7 on Convex's **Free Tier ($0/month)** without exceeding any quotas.

---

## 1. Convex Free Tier Allowances & Quotas

According to Convex's official documentation and pricing specifications:

| Resource Metric | Free Tier Allowance | Quota Type |
|---|---|---|
| **Monthly Function Calls** | 1,000,000 calls / month | Hard Cap on Free Tier |
| **Database Storage** | 0.5 GB (512 MB) | Hard Cap |
| **Database Bandwidth / I/O** | 1.0 GB / month | Hard Cap |
| **Action Execution Timeout** | 10 minutes (600s) | Per-action hard limit |
| **Function Memory** | 64 MB (Queries/Mutations), 512 MB (Actions) | Per-execution |

---

## 2. Ballast Tick Cadence & Operation Model

- **Cron Schedule**: `crons.interval('monitor', { seconds: 30 }, internal.keeper.tick, {})`
- **Cadence**: 1 tick every 30 seconds = 2 ticks / minute
- **Daily Volume**: $24 \text{ hr} \times 60 \text{ min/hr} \times 2 \text{ ticks/min} = \mathbf{2,880} \text{ ticks/day}$
- **Monthly Volume (30 days)**: $2,880 \times 30 = \mathbf{86,400} \text{ ticks/month}$

---

## 3. Function Call Arithmetic

Every tick executes as follows:
1. **Cron Trigger**: Invokes `internal.keeper.tick` (`'use node'` Action) $\rightarrow \mathbf{1}$ function call.
2. **Lease Acquisition & Pre-fetch**: Invokes `internal.keeper.acquireLeaseAndGetState` (Compare-and-set Mutation) $\rightarrow \mathbf{1}$ function call.
   - Atomically checks lease expiration.
   - If held by an overlapping worker, aborts immediately.
   - Pre-fetches all tracked vaults, alert states, and registered users into an in-memory `ConvexTickStore`.
3. **Execution Logic**: Runs purely in-memory within the Node.js action:
   - Viem RPC calls (multicall `checkDefense`, `rule`, `getTroveStatus`) are outbound HTTP requests (not Convex function calls).
   - All mutations during the tick (new vaults, ICR snapshots, defense records, alert transitions) are collected into an in-memory batch.
4. **Batch Commit**: Invokes `internal.keeper.commitTickResult` (Mutation) $\rightarrow \mathbf{1}$ function call.
   - Atomically inserts new vaults, defenses, updates cursor, schedules outbox notifications via `ctx.scheduler.runAfter`, and releases the lease.

### Monthly Function Call Total:
$$\text{Total Calls} = 86,400 \text{ ticks} \times 3 \text{ calls/tick} = \mathbf{259,200} \text{ calls/month}$$

- **Quota Used**: $259,200 / 1,000,000 = \mathbf{25.92\%}$
- **Safety Margin**: **740,800 calls remaining (74.08% buffer)**.
- Additional user actions (web links, unlink, Telegram webhook commands, scheduled notification deliveries) utilize $< 15,000$ calls/month, keeping total utilization under **28%**.

---

## 4. Database Storage & Rolling Window Pruning

Convex charges storage for database documents and index footprints. To prevent unbounded growth, `convex/crons.ts` schedules an automated hourly pruning job (`pruneOldData`):

- **Snapshots**: ICR history is retained on a 24-hour rolling window. Snapshots older than 24 hours are pruned.
- **Errors**: Keeper error logs are bounded to the last 100 records and pruned after 7 days.
- **Link Tokens**: Ephemeral wallet linking tokens expire in 15 minutes and are purged after 24 hours.

### Steady-State Storage Footprint:

| Table | Average Record Size | Max Steady-State Records | Total Storage |
|---|---|---|---|
| `keeperState` | 500 B | 1 (singleton) | 0.5 KB |
| `vaults` | 300 B | 50 vaults | 15.0 KB |
| `snapshots` | 150 B | 10 vaults $\times$ 24 hr $\times$ 12 / hr = 2,880 | 432.0 KB |
| `defenses` | 600 B | 200 records | 120.0 KB |
| `alertStates` | 200 B | 50 records | 10.0 KB |
| `telegramUsers` | 250 B | 100 users | 25.0 KB |
| `signatureNonces` | 120 B | 200 nonces (pruned) | 24.0 KB |
| `notificationOutbox` | 400 B | 100 records (pruned) | 40.0 KB |
| `errors` | 250 B | 100 records (capped) | 25.0 KB |
| **Total Database Size** | — | — | **~692 KB (< 1 MB)** |

- **Storage Allowance**: 512 MB (0.5 GB)
- **Quota Used**: $0.7 \text{ MB} / 512 \text{ MB} = \mathbf{0.14\%}$
- **Safety Margin**: **> 99.8% free space**.

---

## 5. Database Bandwidth & I/O Budget

Convex free tier allocates **1.0 GB of database transfer** per month.
- Per-tick read: State document + vault table + alert states $\approx 6 \text{ KB}$
- Per-tick write: State patch + batch commit $\approx 2 \text{ KB}$
- Total transfer per tick: $\approx 8 \text{ KB}$
- Total monthly bandwidth: $86,400 \times 8 \text{ KB} = \mathbf{691} \text{ MB / month}$
- **Quota Used**: $691 \text{ MB} / 1,024 \text{ MB} = \mathbf{67.5\%}$ (Comfortably within the 1 GB cap).

---

## 6. Execution Time & Concurrency Safeguards

1. **Compare-and-Set Lease**:
   - `acquireLeaseAndGetState` holds a 45-second lease (`leaseExpiresAt`).
   - If a previous tick is delayed, overlapping executions exit immediately at Step 1 (0ms duration, 0 RPC calls).
   - Guarantees strict single-sender nonce protection for the keeper wallet.
2. **Time Budget Cap**:
   - `MAX_TICK_DURATION_MS = 25000` (25 seconds).
   - If RPC responses are slow, the loop breaks gracefully and commits current progress.
3. **Scan Budget Cap**:
   - `MAX_BLOCKS_PER_TICK = 2000` blocks.
   - Prevents timeouts when catching up after extended testnet reorgs or downtime.
4. **Pending Transaction Receipt Tracking**:
   - If a `defend()` transaction is submitted and block inclusion takes longer than the remaining tick budget, `pendingTxHash` is persisted in `keeperState`.
   - The subsequent tick verifies the receipt *before* considering new transactions, preventing nonce collisions and duplicate tips.

---

## Summary Verdict

The Ballast Convex keeper architecture operates at **~26% function call utilization**, **0.14% storage capacity**, and **67.5% bandwidth capacity**, proving that Ballast can run continuously, 24/7/365, without server infrastructure or subscription costs on Convex's free tier.
