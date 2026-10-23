// @ts-nocheck
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { createPublicClient, http, formatEther, type Address } from "viem";
import { MATSNET_CHAIN_ID } from "@ballast/shared";
import { privateKeyToAccount } from "viem/accounts";

const httpRoute = httpRouter();

/**
 * Health check endpoint: GET /healthz
 * Returns: last successful tick age, vault count, circuit breaker state, keeper balance.
 * Strictly NO secrets or sensitive variables exposed.
 */
httpRoute.route({
  path: "/healthz",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const health = await ctx.runQuery(api.keeper.getHealth, {});

      // Fetch keeper address balance if private key is present in environment
      let keeperBalanceBtc: string | null = null;
      let keeperAddress: string | null = null;

      const pk = process.env.KEEPER_PRIVATE_KEY;
      if (pk) {
        try {
          const account = privateKeyToAccount(pk as any);
          keeperAddress = account.address;
          const rpcUrl = process.env.RPC_URL || "https://rpc.test.mezo.org";
          const client = createPublicClient({
            chain: {
              id: MATSNET_CHAIN_ID,
              name: "Mezo Testnet",
              nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
              rpcUrls: { default: { http: [rpcUrl] } },
            },
            transport: http(rpcUrl),
          });
          const bal = await client.getBalance({ address: account.address });
          keeperBalanceBtc = formatEther(bal);
        } catch {
          // RPC failure should not crash health endpoint
        }
      }

      const status = health.healthy ? 200 : 503;
      const body = {
        status: health.healthy ? "healthy" : "degraded",
        lastSuccessAgeSec: health.lastSuccessAgeSec,
        vaultCount: health.vaultCount,
        circuitBreakerTripped: health.breakerTripped,
        circuitBreakerReason: health.circuitBreakerReason,
        cursorBlock: health.cursorBlock,
        pendingTx: health.pendingTx,
        keeperAddress,
        keeperBalanceBtc,
        timestamp: Date.now(),
      };

      return new Response(JSON.stringify(body, null, 2), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({ status: "error", error: err.message || String(err) }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * Telegram Webhook Handler: POST /telegram/webhook
 * Authenticates Telegram request via X-Telegram-Bot-Api-Secret-Token,
 * and processes the update asynchronously.
 */
httpRoute.route({
  path: "/telegram/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Verify Secret Token Header
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (configuredSecret && secretHeader !== configuredSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parse Telegram Update
    let update: any;
    try {
      update = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Delegate to processWebhookUpdate action
    try {
      await ctx.runAction(internal.telegram.processWebhookUpdate, { update });
      return new Response("OK", { status: 200 });
    } catch (err: any) {
      console.error("Error processing Telegram webhook update:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
});

export default httpRoute;
