import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Singleton keeper coordination & lease state
  keeperState: defineTable({
    leaseHolder: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    cursorBlock: v.number(),
    lastIndexedAt: v.number(),
    circuitBreakerTripped: v.boolean(),
    circuitBreakerTrippedAt: v.optional(v.number()),
    circuitBreakerReason: v.optional(v.string()),
    consecutiveFailures: v.number(),
    lastSuccessTime: v.number(),
    lastTickTime: v.number(),
    lastTickDurationMs: v.optional(v.number()),
    pendingTxHash: v.optional(v.string()),
    pendingTxVault: v.optional(v.string()),
    pendingTxSubmittedAt: v.optional(v.number()),
  }),

  // Tracked Ballast vaults discovered from factory events
  vaults: defineTable({
    address: v.string(), // lowercase
    owner: v.string(),   // lowercase
    createdBlock: v.number(),
    txHash: v.string(),
    discoveredAt: v.string(),
  })
    .index("by_address", ["address"])
    .index("by_owner", ["owner"])
    .index("by_created_block", ["createdBlock"]),

  // Rolling window of ICR snapshots for analytics & trends (pruned)
  snapshots: defineTable({
    vault: v.string(),   // lowercase
    icr: v.string(),
    blockNumber: v.number(),
    timestamp: v.number(),
  })
    .index("by_vault", ["vault"])
    .index("by_vault_timestamp", ["vault", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // On-chain defense executions (simulated, submitted, confirmed, failed)
  defenses: defineTable({
    vault: v.string(),   // lowercase
    txHash: v.string(),
    keeper: v.string(),  // lowercase
    blockNumber: v.number(),
    musdRepaid: v.string(),
    btcAdded: v.string(),
    musdTip: v.string(),
    btcTip: v.string(),
    oldIcr: v.string(),
    newIcr: v.string(),
    gasUsed: v.optional(v.string()),
    effectiveGasPrice: v.optional(v.string()),
    status: v.string(), // "simulated" | "submitted" | "confirmed" | "failed"
    createdAt: v.string(),
    timestamp: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_vault", ["vault"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["timestamp"]),

  // Bounded keeper error log (capped to last 100 entries)
  errors: defineTable({
    type: v.string(),
    message: v.string(),
    details: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  // Ephemeral single-use link tokens for Telegram wallet linking
  linkTokens: defineTable({
    token: v.string(),
    chatId: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_expires", ["expiresAt"]),

  // Telegram user bindings & alert preferences
  telegramUsers: defineTable({
    chatId: v.string(),
    address: v.string(), // lowercase
    watchPercent: v.optional(v.number()),
    mutedUntil: v.number(),
    createdAt: v.string(),
  })
    .index("by_address", ["address"])
    .index("by_chat", ["chatId"])
    .index("by_chat_and_address", ["chatId", "address"]),

  // Replay protection for wallet signature auth
  signatureNonces: defineTable({
    nonce: v.string(),
    address: v.string(), // lowercase
    usedAt: v.number(),
  }).index("by_nonce_and_address", ["nonce", "address"]),

  // Alert hysteresis states (early-warning hysteresis & armed flags)
  alertStates: defineTable({
    key: v.string(),     // `${vault.toLowerCase()}:${alertType}`
    vault: v.string(),   // lowercase
    alertType: v.string(),
    armed: v.boolean(),
    lastVal: v.optional(v.string()),
    lastSentAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_vault", ["vault"]),

  // Notification outbox with retries, exponential backoff, and idempotency
  notificationOutbox: defineTable({
    idempotencyKey: v.string(),
    chatId: v.string(),
    message: v.string(),
    status: v.string(), // "pending" | "sent" | "failed" | "muted"
    attempts: v.number(),
    maxAttempts: v.number(),
    nextRetryAt: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.string(),
    sentAt: v.optional(v.string()),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status_retry", ["status", "nextRetryAt"]),

  // Per-address rate limiting
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    resetAt: v.number(),
  }).index("by_key", ["key"]),
});
