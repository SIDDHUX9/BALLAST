// @ts-nocheck
import { mutation, query, internalMutation, internalQuery, internalAction, action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Bot } from "grammy";
import {
  createPublicClient,
  http,
  type Address,
  formatEther,
} from "viem";
import {
  BRAND_NAME,
  BallastVaultAbi,
  BallastFactoryAbi,
  computeLiquidationPrice,
  computeAbsorptionCapacity,
  MATSNET_PROTOCOL_ADDRESSES,
  MATSNET_CHAIN_ID,
  PRECISION,
} from "@ballast/shared";
import {
  verifyAndProcessLink,
  verifyAndProcessUnlink,
} from "../apps/keeper/src/core/signatures.js";

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates an ephemeral, single-use link token for Telegram deep linking.
 */
export const createLinkToken = mutation({
  args: {},
  handler: async (ctx) => {
    // 32-character random hex token
    const token = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const now = Date.now();
    const expiresAt = now + TOKEN_EXPIRY_MS;

    await ctx.db.insert("linkTokens", {
      token,
      createdAt: now,
      expiresAt,
      used: false,
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "BALLASTBTC_bot";
    return {
      token,
      expiresAt,
      deepLink: `https://t.me/${botUsername}?start=${token}`,
    };
  },
});

/**
 * Checks link token state (whether chat has registered via /start <token>).
 */
export const getLinkTokenStatus = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("linkTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!record) {
      return { status: "not_found" };
    }
    if (record.used) {
      return { status: "used" };
    }
    if (record.expiresAt < Date.now()) {
      return { status: "expired" };
    }

    return {
      status: record.chatId ? "chat_bound" : "pending_chat",
      chatId: record.chatId ?? null,
      expiresAt: record.expiresAt,
    };
  },
});

/**
 * Records the Telegram chat ID against a link token when the user clicks Start.
 */
export const recordChatForToken = internalMutation({
  args: { token: v.string(), chatId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("linkTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!record || record.used || record.expiresAt < Date.now()) {
      return false;
    }

    await ctx.db.patch(record._id, {
      chatId: args.chatId,
    });
    return true;
  },
});

/**
 * Checks and updates per-address rate limiting.
 */
export const checkRateLimit = internalMutation({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const key = `ratelimit:${args.address.toLowerCase()}`;
    const now = Date.now();
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!record || record.resetAt < now) {
      if (record) {
        await ctx.db.patch(record._id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      } else {
        await ctx.db.insert("rateLimits", { key, count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      }
      return { allowed: true };
    }

    if (record.count >= MAX_RATE_LIMIT_ATTEMPTS) {
      return { allowed: false, retryAfterSec: Math.ceil((record.resetAt - now) / 1000) };
    }

    await ctx.db.patch(record._id, { count: record.count + 1 });
    return { allowed: true };
  },
});

/**
 * Consumes a signature nonce to prevent replay attacks.
 */
export const useSignatureNonce = internalMutation({
  args: { nonce: v.string(), address: v.string() },
  handler: async (ctx, args) => {
    const addr = args.address.toLowerCase();
    const existing = await ctx.db
      .query("signatureNonces")
      .withIndex("by_nonce_and_address", (q) =>
        q.eq("nonce", args.nonce).eq("address", addr)
      )
      .first();

    if (existing) return false;

    await ctx.db.insert("signatureNonces", {
      nonce: args.nonce,
      address: addr,
      usedAt: Date.now(),
    });
    return true;
  },
});

/**
 * Saves or updates wallet-to-chat binding.
 */
export const bindWalletToChat = internalMutation({
  args: {
    chatId: v.string(),
    address: v.string(),
    token: v.string(),
    watchPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const addr = args.address.toLowerCase();

    // Mark link token as consumed
    const tok = await ctx.db
      .query("linkTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (tok) {
      await ctx.db.patch(tok._id, { used: true });
    }

    // Save telegramUser binding
    const existing = await ctx.db
      .query("telegramUsers")
      .withIndex("by_chat_and_address", (q) =>
        q.eq("chatId", args.chatId).eq("address", addr)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        watchPercent: args.watchPercent ?? existing.watchPercent,
      });
    } else {
      await ctx.db.insert("telegramUsers", {
        chatId: args.chatId,
        address: addr,
        watchPercent: args.watchPercent ?? null,
        mutedUntil: 0,
        createdAt: new Date().toISOString(),
      });
    }
  },
});

/**
 * Unlinks a wallet address.
 */
export const unlinkWallet = internalMutation({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const addr = args.address.toLowerCase();
    const records = await ctx.db
      .query("telegramUsers")
      .withIndex("by_address", (q) => q.eq("address", addr))
      .collect();

    for (const r of records) {
      await ctx.db.delete(r._id);
    }
  },
});

/**
 * Web App Action: Verifies signature (EOA + ERC-1271) and permanently links Telegram.
 */
export const verifyAndLink = action({
  args: {
    token: v.string(),
    address: v.string(),
    nonce: v.string(),
    expiry: v.number(),
    signature: v.string(),
    watchPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    "use node";
    const addr = args.address.toLowerCase() as Address;

    // 1. Rate limiting
    const rateCheck = await ctx.runMutation(internal.telegram.checkRateLimit, {
      address: addr,
    });
    if (!rateCheck.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rateCheck.retryAfterSec}s.`);
    }

    // 2. Expiry check
    if (args.expiry <= Date.now()) {
      throw new Error("Signature request has expired.");
    }

    // 3. Token check
    const tokenStatus = await ctx.runQuery(api.telegram.getLinkTokenStatus, {
      token: args.token,
    });
    if (tokenStatus.status !== "chat_bound" || !tokenStatus.chatId) {
      throw new Error("Link token has not yet been registered in Telegram bot. Press Start in the bot first.");
    }

    // 4. Nonce replay check
    const nonceSaved = await ctx.runMutation(internal.telegram.useSignatureNonce, {
      nonce: args.nonce,
      address: addr,
    });
    if (!nonceSaved) {
      throw new Error("Nonce already used. Replay protection triggered.");
    }

    // 5. Viem PublicClient for EOA & ERC-1271 verification
    const rpcUrl = process.env.RPC_URL || "https://rpc.test.mezo.org";
    const publicClient = createPublicClient({
      chain: {
        id: MATSNET_CHAIN_ID,
        name: "Mezo Testnet",
        nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
        rpcUrls: { default: { http: [rpcUrl] } },
        contracts: {
          multicall3: {
            address: "0xca11bde05977b3631167028862be2a173976ca11",
            blockCreated: 0,
          },
        },
      },
      transport: http(rpcUrl),
    });

    // In-memory verification adapter
    const dummyStore = {
      getLinkToken: async () => ({
        token: args.token,
        chatId: tokenStatus.chatId,
        createdAt: 0,
        expiresAt: Date.now() + 60000,
        used: false,
      }),
      markLinkTokenUsed: async () => {},
      useSignatureNonce: async () => true,
      linkTelegramUser: async () => {},
    };

    const verifyResult = await verifyAndProcessLink(
      publicClient,
      dummyStore as any,
      {
        token: args.token,
        address: addr,
        nonce: args.nonce,
        expiresAt: args.expiry,
        expiry: args.expiry,
        signature: args.signature as any,
        watchPercent: args.watchPercent,
      }
    );

    if (!verifyResult.ok) {
      throw new Error(verifyResult.error || "Signature verification failed");
    }

    // 6. Bind wallet permanently
    await ctx.runMutation(internal.telegram.bindWalletToChat, {
      chatId: tokenStatus.chatId,
      address: addr,
      token: args.token,
      watchPercent: args.watchPercent,
    });

    return { success: true, chatId: tokenStatus.chatId };
  },
});

/**
 * Web App Action: Verifies signature and unlinks wallet address.
 */
export const verifyAndUnlink = action({
  args: {
    address: v.string(),
    nonce: v.string(),
    expiry: v.number(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    "use node";
    const addr = args.address.toLowerCase() as Address;

    if (args.expiry <= Date.now()) {
      throw new Error("Signature request has expired.");
    }

    const nonceSaved = await ctx.runMutation(internal.telegram.useSignatureNonce, {
      nonce: args.nonce,
      address: addr,
    });
    if (!nonceSaved) {
      throw new Error("Nonce already used.");
    }

    const rpcUrl = process.env.RPC_URL || "https://rpc.test.mezo.org";
    const publicClient = createPublicClient({
      chain: {
        id: MATSNET_CHAIN_ID,
        name: "Mezo Testnet",
        nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
        rpcUrls: { default: { http: [rpcUrl] } },
        contracts: {
          multicall3: {
            address: "0xca11bde05977b3631167028862be2a173976ca11",
            blockCreated: 0,
          },
        },
      },
      transport: http(rpcUrl),
    });

    const dummyStore = {
      useSignatureNonce: async () => true,
      unlinkTelegramUser: async () => {},
    };

    const verifyResult = await verifyAndProcessUnlink(
      publicClient,
      dummyStore as any,
      {
        address: addr,
        nonce: args.nonce,
        expiresAt: args.expiry,
        expiry: args.expiry,
        signature: args.signature as any,
      }
    );

    if (!verifyResult.ok) {
      throw new Error(verifyResult.error || "Unlink signature verification failed");
    }

    await ctx.runMutation(internal.telegram.unlinkWallet, {
      address: addr,
    });

    return { success: true };
  },
});

/**
 * Scheduled Outbox Delivery Action:
 * Delivers telegram message with retries, exponential backoff, and strict idempotency.
 */
export const deliverNotification = internalAction({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    "use node";
    const outboxRecord = await ctx.runQuery(internal.telegram.getOutboxRecord, {
      idempotencyKey: args.idempotencyKey,
    });

    if (!outboxRecord || outboxRecord.status !== "pending") {
      return; // Already sent or handled
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN not configured, notification marked skipped");
      return;
    }

    // Check mute state
    const user = await ctx.runQuery(internal.telegram.getUserByChat, {
      chatId: outboxRecord.chatId,
    });
    if (user && user.mutedUntil > Date.now()) {
      await ctx.runMutation(internal.telegram.updateOutboxStatus, {
        idempotencyKey: args.idempotencyKey,
        status: "muted",
      });
      return;
    }

    const bot = new Bot(botToken);
    try {
      await bot.api.sendMessage(outboxRecord.chatId, outboxRecord.message, {
        link_preview_options: { is_disabled: true },
      });

      await ctx.runMutation(internal.telegram.updateOutboxStatus, {
        idempotencyKey: args.idempotencyKey,
        status: "sent",
        sentAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const attempts = outboxRecord.attempts + 1;
      const maxAttempts = outboxRecord.maxAttempts || 5;

      if (attempts >= maxAttempts) {
        await ctx.runMutation(internal.telegram.updateOutboxStatus, {
          idempotencyKey: args.idempotencyKey,
          status: "failed",
          attempts,
          lastError: err.message || String(err),
        });
      } else {
        const delaySec = Math.pow(2, attempts) * 5; // 10s, 20s, 40s, 80s
        const nextRetryAt = Date.now() + delaySec * 1000;

        await ctx.runMutation(internal.telegram.updateOutboxStatus, {
          idempotencyKey: args.idempotencyKey,
          status: "pending",
          attempts,
          nextRetryAt,
          lastError: err.message || String(err),
        });

        // Reschedule retry
        await ctx.scheduler.runAfter(delaySec * 1000, internal.telegram.deliverNotification, {
          idempotencyKey: args.idempotencyKey,
        });
      }
    }
  },
});

export const getOutboxRecord = internalQuery({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notificationOutbox")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
  },
});

export const getUserByChat = internalQuery({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("telegramUsers")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .first();
  },
});

export const getAllUsersByChat = internalQuery({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("telegramUsers")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

export const updateWatchPercentByChat = internalMutation({
  args: { chatId: v.string(), watchPercent: v.number() },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("telegramUsers")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    for (const u of users) {
      await ctx.db.patch(u._id, { watchPercent: args.watchPercent });
    }
    return users.length;
  },
});

export const setMuteByChat = internalMutation({
  args: { chatId: v.string(), mutedUntil: v.number() },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("telegramUsers")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    for (const u of users) {
      await ctx.db.patch(u._id, { mutedUntil: args.mutedUntil });
    }
    return users.length;
  },
});

export const unlinkByChat = internalMutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("telegramUsers")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    for (const u of users) {
      await ctx.db.delete(u._id);
    }
    return users.length;
  },
});

export const updateOutboxStatus = internalMutation({
  args: {
    idempotencyKey: v.string(),
    status: v.string(),
    attempts: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    sentAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (record) {
      await ctx.db.patch(record._id, {
        status: args.status,
        attempts: args.attempts ?? record.attempts,
        nextRetryAt: args.nextRetryAt ?? record.nextRetryAt,
        lastError: args.lastError ?? record.lastError,
        sentAt: args.sentAt ?? record.sentAt,
      });
    }
  },
});

/**
 * Action to process incoming Telegram updates from the HTTP webhook.
 */
export const processWebhookUpdate = internalAction({
  args: { update: v.any() },
  handler: async (ctx, args) => {
    "use node";
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_TOKEN;
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN not configured in Convex environment");
      return;
    }

    const bot = new Bot(botToken, {
      botInfo: {
        id: 8801692169,
        is_bot: true,
        first_name: "BALLAST",
        username: "BALLASTBTC_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
      },
    });

    bot.catch((err) => {
      console.error("GrammY bot error in handleUpdate:", err);
    });

    // /start command
    bot.command("start", async (c) => {
      const token = c.match?.trim();
      const chatId = String(c.chat.id);

      if (token) {
        const recorded = await ctx.runMutation(internal.telegram.recordChatForToken, {
          token,
          chatId,
        });
        if (recorded) {
          await c.reply(
            "Telegram chat registered for link token.\nPlease return to Ballast and sign the verification message with your wallet to complete linking."
          );
        } else {
          await c.reply("Invalid or expired link token. Please generate a new link in the Ballast web app.");
        }
        return;
      }

      // Plain /start without token
      const linked = await ctx.runQuery(internal.telegram.getAllUsersByChat, { chatId });
      if (linked && linked.length > 0) {
        const addresses = linked.map((u: any) => `${u.address.slice(0, 6)}…${u.address.slice(-4)}`).join(", ");
        await c.reply(
          `${BRAND_NAME} Alert Bot\nLinked wallet(s): ${addresses}\nUse /status to inspect your vaults, or /help for commands.`
        );
      } else {
        await c.reply(
          `Welcome to ${BRAND_NAME} Alert Bot.\nTo link your wallet, connect your wallet at the ${BRAND_NAME} web app and select 'Link Telegram'.`
        );
      }
    });

    // /status command: reads on-chain live trove and vault metrics
    bot.command("status", async (c) => {
      const chatId = String(c.chat.id);
      const linked = await ctx.runQuery(internal.telegram.getAllUsersByChat, { chatId });

      if (!linked || linked.length === 0) {
        await c.reply(
          `No linked wallets found for this chat. Please connect your wallet in the ${BRAND_NAME} web app and select 'Link Telegram' under Alerts.`
        );
        return;
      }

      const rpcUrl = process.env.RPC_URL || "https://rpc.test.mezo.org";
      const publicClient = createPublicClient({
        chain: {
          id: MATSNET_CHAIN_ID,
          name: "Mezo Testnet",
          nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
          rpcUrls: { default: { http: [rpcUrl] } },
        },
        transport: http(rpcUrl),
      });

      const factoryAddress = (process.env.FACTORY_ADDRESS || "0x8d5b392839300b487addeecc35f5bc534111cd33") as Address;
      const reports: string[] = [];

      for (const user of linked) {
        try {
          // Look up vault address
          let vaultAddress: Address | undefined;
          try {
            vaultAddress = (await publicClient.readContract({
              address: factoryAddress,
              abi: BallastFactoryAbi,
              functionName: "vaultOf",
              args: [user.address as Address],
            })) as Address;
          } catch {
            // Not found
          }

          if (!vaultAddress || vaultAddress === "0x0000000000000000000000000000000000000000") {
            reports.push(`Wallet: ${user.address}\nVault: None deployed yet.`);
            continue;
          }

          // Read on-chain vault metrics
          const [checkRes, musdRes, btcRes, ruleRes] = await Promise.all([
            publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: "checkDefense",
            }) as Promise<[boolean, bigint, bigint, bigint]>,
            publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: "musdReserve",
            }) as Promise<bigint>,
            publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: "btcReserve",
            }) as Promise<bigint>,
            publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: "rule",
            }) as Promise<[boolean, bigint, bigint, number]>,
          ]);

          const icr = checkRes[1];
          const triggerICR = ruleRes[1];

          // Trove debt & coll from TroveManager
          const [debt, coll, status] = await Promise.all([
            publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
              abi: [
                {
                  type: "function",
                  name: "getTroveDebt",
                  inputs: [{ name: "_borrower", type: "address" }],
                  outputs: [{ name: "", type: "uint256" }],
                  stateMutability: "view",
                },
              ],
              functionName: "getTroveDebt",
              args: [vaultAddress],
            }) as Promise<bigint>,
            publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
              abi: [
                {
                  type: "function",
                  name: "getTroveColl",
                  inputs: [{ name: "_borrower", type: "address" }],
                  outputs: [{ name: "", type: "uint256" }],
                  stateMutability: "view",
                },
              ],
              functionName: "getTroveColl",
              args: [vaultAddress],
            }) as Promise<bigint>,
            publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
              abi: [
                {
                  type: "function",
                  name: "getTroveStatus",
                  inputs: [{ name: "_borrower", type: "address" }],
                  outputs: [{ name: "", type: "uint256" }],
                  stateMutability: "view",
                },
              ],
              functionName: "getTroveStatus",
              args: [vaultAddress],
            }) as Promise<bigint>,
          ]);

          const mcr = 1100000000000000000n; // 110%
          const liqPrice = computeLiquidationPrice(coll, debt, mcr);
          const icrPct = (Number((icr * 10000n) / PRECISION) / 100).toFixed(1);
          const triggerPct = (Number((triggerICR * 10000n) / PRECISION) / 100).toFixed(1);
          const watchPct = (user.watchPercent ?? Number(triggerPct) + 10).toFixed(1);

          const liqPriceFormatted = Number(formatEther(liqPrice)).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });

          const musdFormatted = Number(formatEther(musdRes)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const btcFormatted = Number(formatEther(btcRes)).toFixed(4);

          let statusStr = "Active";
          if (status === 2n) statusStr = "Closed by Owner";
          if (status === 3n) statusStr = "Liquidated";
          if (status === 4n) statusStr = "Redeemed";

          reports.push(
            [
              `🛡️ *Vault*: \`${vaultAddress}\``,
              `📊 *Status*: ${statusStr}`,
              `⚡ *ICR*: ${icrPct}% (Trigger: ${triggerPct}%, Watch: ${watchPct}%)`,
              `🎯 *Liquidation Price*: $${liqPriceFormatted}`,
              `💵 *MUSD Reserve*: ${musdFormatted} MUSD`,
              `🪙 *BTC Reserve*: ${btcFormatted} BTC`,
              `🔗 https://explorer.test.mezo.org/address/${vaultAddress}`,
            ].join("\n")
          );
        } catch (err: any) {
          reports.push(`Wallet: ${user.address}\nError reading vault status: ${err.message || String(err)}`);
        }
      }

      await c.reply(reports.join("\n\n"), { parse_mode: "Markdown" });
    });

    // /watch <percent>
    bot.command("watch", async (c) => {
      const chatId = String(c.chat.id);
      const text = c.match?.trim();

      if (!text) {
        await c.reply("Usage: /watch <percent>\nExample: /watch 145");
        return;
      }

      const percent = parseFloat(text.replace("%", ""));
      if (isNaN(percent) || percent < 110 || percent > 500) {
        await c.reply("Invalid percentage. Watch level must be between 110% and 500%.");
        return;
      }

      await ctx.runMutation(internal.telegram.updateWatchPercentByChat, {
        chatId,
        watchPercent: percent,
      });

      await c.reply(
        `Watch alert level updated to ${percent.toFixed(1)}%.\nYou will be alerted if your ICR drops below this level.`
      );
    });

    // /mute <hours>
    bot.command("mute", async (c) => {
      const chatId = String(c.chat.id);
      const text = c.match?.trim();

      if (!text) {
        await c.reply("Usage: /mute <hours>\nExample: /mute 4");
        return;
      }

      const hours = parseInt(text, 10);
      if (isNaN(hours) || hours < 1 || hours > 168) {
        await c.reply("Invalid duration. Mute period must be between 1 and 168 hours (1 week).");
        return;
      }

      const mutedUntil = Date.now() + hours * 3600 * 1000;
      await ctx.runMutation(internal.telegram.setMuteByChat, { chatId, mutedUntil });
      const dateStr = new Date(mutedUntil).toUTCString();

      await c.reply(`Alerts muted for ${hours} hours (until ${dateStr}).`);
    });

    // /unmute
    bot.command("unmute", async (c) => {
      const chatId = String(c.chat.id);
      await ctx.runMutation(internal.telegram.setMuteByChat, { chatId, mutedUntil: 0 });
      await c.reply("Alerts unmuted. You will receive active defense and warning alerts.");
    });

    // /unlink
    bot.command("unlink", async (c) => {
      const chatId = String(c.chat.id);
      await ctx.runMutation(internal.telegram.unlinkByChat, { chatId });
      await c.reply(
        "Unlinked successfully. All wallet associations and alert preferences have been deleted."
      );
    });

    // /help command
    bot.command("help", async (c) => {
      await c.reply(
        `${BRAND_NAME} Alert Bot Commands:\n/status - View live ICR and reserves\n/watch <percent> - Set custom warning threshold\n/mute <hours> - Temporarily mute alerts\n/unmute - Unmute alerts immediately\n/unlink - Unlink chat from wallet\n/help - Show this message`
      );
    });

    // Catch-all message handler for plain text
    bot.on("message:text", async (c) => {
      if (c.message?.text?.startsWith("/")) return;

      const chatId = String(c.chat.id);
      const linked = await ctx.runQuery(internal.telegram.getAllUsersByChat, { chatId });

      if (linked && linked.length > 0) {
        await c.reply(
          `Hello! I received your message: "${c.message.text}".\n\nCommands you can use:\n/status — Check live trove ICR & reserves\n/watch — Adjust warning alert threshold\n/mute — Pause notifications\n/help — Full command guide`
        );
      } else {
        await c.reply(
          `Hello! You have reached the ${BRAND_NAME} Alert Bot.\n\nTo link your Mezo wallet, visit the Ballast web app under Alerts and click 'Link Telegram'.\nType /help for available commands.`
        );
      }
    });

    // Initialize bot if not initialized and handle update
    await bot.init();
    await bot.handleUpdate(args.update);
  },
});

/**
 * Public Query: Reads telegram binding and preferences for a wallet address.
 */
export const getUserBinding = query({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const addr = args.address.toLowerCase();
    const user = await ctx.db
      .query("telegramUsers")
      .withIndex("by_address", (q) => q.eq("address", addr))
      .first();

    if (!user) {
      return {
        linked: false,
        chatId: null,
        watchPercent: null,
        mutedUntil: 0,
        isMuted: false,
        createdAt: null,
      };
    }

    const isMuted = user.mutedUntil > Date.now();
    return {
      linked: true,
      chatId: user.chatId,
      watchPercent: user.watchPercent ?? null,
      mutedUntil: user.mutedUntil,
      isMuted,
      createdAt: user.createdAt,
    };
  },
});

/**
 * Public Mutation: Updates custom watch-level threshold for linked user.
 */
export const updateWatchPercent = mutation({
  args: { address: v.string(), watchPercent: v.number() },
  handler: async (ctx, args) => {
    const addr = args.address.toLowerCase();
    const user = await ctx.db
      .query("telegramUsers")
      .withIndex("by_address", (q) => q.eq("address", addr))
      .first();

    if (!user) {
      throw new Error("No linked Telegram account found for this address");
    }

    await ctx.db.patch(user._id, {
      watchPercent: args.watchPercent,
    });
    return true;
  },
});

/**
 * Public Mutation: Mutes or unmutes telegram alerts for linked user.
 */
export const setMute = mutation({
  args: { address: v.string(), hours: v.number() },
  handler: async (ctx, args) => {
    const addr = args.address.toLowerCase();
    const user = await ctx.db
      .query("telegramUsers")
      .withIndex("by_address", (q) => q.eq("address", addr))
      .first();

    if (!user) {
      throw new Error("No linked Telegram account found for this address");
    }

    const mutedUntil = args.hours > 0 ? Date.now() + args.hours * 3600 * 1000 : 0;
    await ctx.db.patch(user._id, { mutedUntil });
    return { mutedUntil, isMuted: mutedUntil > Date.now() };
  },
});

