import crypto from 'node:crypto';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type Address, type Hex, type PublicClient } from 'viem';
import { BRAND_NAME } from '@ballast/shared';
import type { KeeperDatabase } from '../db.js';
import type { TelegramBotService } from './bot.js';

export function formatLinkMessage(params: {
  token: string;
  address: Address;
  nonce: string;
  expiresAt: number;
}): string {
  return [
    `Sign to link Telegram to ${BRAND_NAME}:`,
    `Token: ${params.token}`,
    `Wallet: ${params.address.toLowerCase()}`,
    `Nonce: ${params.nonce}`,
    `Expires At: ${new Date(params.expiresAt).toISOString()}`,
  ].join('\n');
}

export function formatUnlinkMessage(params: {
  address: Address;
  nonce: string;
  expiresAt: number;
}): string {
  return [
    `Sign to unlink Telegram from ${BRAND_NAME}:`,
    `Wallet: ${params.address.toLowerCase()}`,
    `Nonce: ${params.nonce}`,
    `Expires At: ${new Date(params.expiresAt).toISOString()}`,
  ].join('\n');
}

const VerifyLinkSchema = z.object({
  token: z.string().min(16),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((v) => v.toLowerCase() as Address),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/).transform((v) => v as Hex),
  nonce: z.string().min(8),
  expiresAt: z.number().int().positive(),
  watchPercent: z.number().min(110).max(500).optional(),
});

const UnlinkSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((v) => v.toLowerCase() as Address),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/).transform((v) => v as Hex),
  nonce: z.string().min(8),
  expiresAt: z.number().int().positive(),
});

export interface TelegramRoutesOptions {
  db: KeeperDatabase;
  publicClient: PublicClient;
  botUsername: string;
  botService?: TelegramBotService;
}

export function registerTelegramRoutes(
  app: FastifyInstance,
  options: TelegramRoutesOptions,
): void {
  const { db, publicClient, botUsername, botService } = options;

  // 1. Generate Link Token & Deep Link
  app.post(
    '/api/telegram/link-token',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      db.createLinkToken(token, expiresAt);

      const deepLink = `https://t.me/${botUsername}?start=${token}`;
      return reply.send({
        token,
        deepLink,
        expiresAt,
      });
    },
  );

  // 2. Verify Signed Message & Bind Telegram Chat to Address
  app.post(
    '/api/telegram/verify-link',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = VerifyLinkSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.format(),
        });
      }

      const { token, address, signature, nonce, expiresAt, watchPercent } = parseResult.data;

      // Check signature expiration
      if (expiresAt <= Date.now()) {
        return reply.status(400).send({ error: 'Signature expired' });
      }

      // Check and consume nonce for replay protection
      const nonceAccepted = db.useSignatureNonce(nonce, address);
      if (!nonceAccepted) {
        return reply.status(400).send({ error: 'Signature nonce already used (replay rejected)' });
      }

      // Validate link token state
      const tokenRecord = db.getLinkToken(token);
      if (!tokenRecord) {
        return reply.status(400).send({ error: 'Link token not found' });
      }
      if (tokenRecord.used) {
        return reply.status(400).send({ error: 'Link token already used' });
      }
      if (tokenRecord.expiresAt <= Date.now()) {
        return reply.status(400).send({ error: 'Link token expired' });
      }
      if (!tokenRecord.chatId) {
        return reply.status(400).send({
          error: 'Pending chat ID not found. Please click Start in the Telegram bot first.',
        });
      }

      // Verify EIP-191 / ERC-1271 signature via viem
      const expectedMessage = formatLinkMessage({ token, address, nonce, expiresAt });
      try {
        const isValid = await publicClient.verifyMessage({
          address,
          message: expectedMessage,
          signature,
        });

        if (!isValid) {
          return reply.status(400).send({ error: 'Cryptographic signature verification failed' });
        }
      } catch (err) {
        return reply.status(400).send({
          error: 'Signature verification error',
          message: err instanceof Error ? err.message : String(err),
        });
      }

      // Mark token used and permanently bind user
      db.markLinkTokenUsed(token);
      db.linkTelegramUser(tokenRecord.chatId, address, watchPercent ?? null);

      // Send confirmation notification to Telegram
      if (botService) {
        try {
          const welcomeMsg = [
            `Ballast alerts enabled for wallet ${address}.`,
            `Default watch alert: 10% above defense trigger.`,
            `Use /status to inspect your vaults, or /help for commands.`,
          ].join('\n');
          await botService.sendMessage(tokenRecord.chatId, welcomeMsg);
        } catch {
          // Log or enqueue into outbox
        }
      }

      return reply.send({
        ok: true,
        address,
        chatId: tokenRecord.chatId,
      });
    },
  );

  // 3. Web Unlink with Signed Message
  app.post(
    '/api/telegram/unlink',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = UnlinkSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.format(),
        });
      }

      const { address, signature, nonce, expiresAt } = parseResult.data;

      if (expiresAt <= Date.now()) {
        return reply.status(400).send({ error: 'Signature expired' });
      }

      const nonceAccepted = db.useSignatureNonce(nonce, address);
      if (!nonceAccepted) {
        return reply.status(400).send({ error: 'Signature nonce already used (replay rejected)' });
      }

      const expectedMessage = formatUnlinkMessage({ address, nonce, expiresAt });
      try {
        const isValid = await publicClient.verifyMessage({
          address,
          message: expectedMessage,
          signature,
        });

        if (!isValid) {
          return reply.status(400).send({ error: 'Cryptographic signature verification failed' });
        }
      } catch (err) {
        return reply.status(400).send({
          error: 'Signature verification error',
          message: err instanceof Error ? err.message : String(err),
        });
      }

      db.unlinkAddress(address);

      return reply.send({
        ok: true,
        message: 'All Telegram links for this wallet have been removed',
      });
    },
  );

  // 4. Query status for an address
  app.get('/api/telegram/status/:address', async (request, reply) => {
    const params = request.params as { address: string };
    const address = params.address.toLowerCase() as Address;
    const users = db.getTelegramUsersForAddress(address);

    return reply.send({
      isLinked: users.length > 0,
      count: users.length,
    });
  });
}
