import { describe, it, expect, beforeEach } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  type Address,
  type Hex,
  verifyMessage as viemVerifyMessage,
} from 'viem';
import { KeeperDatabase } from '../src/db.js';
import { KeeperMetrics } from '../src/metrics.js';
import {
  formatLinkMessage,
  formatUnlinkMessage,
  verifyAndProcessLink,
  verifyAndProcessUnlink,
} from '../src/core/signatures.js';

function buildServer(ctx?: any, _logLevel?: string) {
  const db = ctx?.db;
  const rpcManager = ctx?.rpcManager;
  const publicClient = rpcManager?.getPublicClient();

  return {
    inject: async (req: { method: string; url: string; payload?: any }) => {
      if (req.url === '/api/telegram/link-token') {
        const token = `token-${Math.random().toString(36).substring(2, 12)}${Date.now()}`;
        db?.createLinkToken(token, Date.now() + 15 * 60 * 1000);
        return {
          statusCode: 200,
          body: JSON.stringify({ token, deepLink: `https://t.me/bot?start=${token}` }),
        };
      }

      if (req.url === '/api/telegram/verify-link') {
        const { token, address, signature, nonce, expiresAt, watchPercent } = req.payload;
        const result = await verifyAndProcessLink(
          publicClient,
          db,
          {
            token,
            address,
            signature,
            nonce,
            expiresAt,
            watchPercent,
          },
        );

        if (!result.ok) {
          return {
            statusCode: 400,
            body: JSON.stringify({ ok: false, error: result.error }),
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true, address: result.address?.toLowerCase(), chatId: result.chatId }),
        };
      }

      if (req.url === '/api/telegram/unlink') {
        const { address, signature, nonce, expiresAt } = req.payload;
        const result = await verifyAndProcessUnlink(
          publicClient,
          db,
          { address, signature, nonce, expiresAt },
        );

        if (!result.ok) {
          return {
            statusCode: 400,
            body: JSON.stringify({ ok: false, error: result.error }),
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true }),
        };
      }

      return { statusCode: 404, body: 'Not found' };
    },
  };
}

describe('Telegram Signature Verification & ERC-1271 Authentication', () => {
  let db: KeeperDatabase;
  let metrics: KeeperMetrics;

  const mockEoaRpcManager = {
    getPublicClient: () => ({
      getBytecode: async () => undefined, // EOA has no bytecode
      verifyMessage: async (args: { address: Address; message: string; signature: Hex }) =>
        viemVerifyMessage({
          address: args.address,
          message: args.message,
          signature: args.signature,
        }),
    }),
    getHealthStatus: () => ({ isHealthy: true }),
  } as any;

  beforeEach(() => {
    db = new KeeperDatabase(':memory:');
    metrics = new KeeperMetrics();
  });

  describe('EOA Signature Linking Flow', () => {
    it('successfully links Telegram chat with a valid EOA signature', async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      const mockEngine = {
        getState: () => ({ isRunning: true }),
        earlyWarningService: { getAllLatestSignals: () => [] },
      } as any;

      const server = buildServer(
        {
          engine: mockEngine,
          metrics,
          rpcManager: mockEoaRpcManager,
          db,
        },
        'silent',
      );

      // Step 1: Generate link token
      const tokenRes = await server.inject({
        method: 'POST',
        url: '/api/telegram/link-token',
      });

      expect(tokenRes.statusCode).toBe(200);
      const { token, deepLink } = JSON.parse(tokenRes.body);
      expect(deepLink).toContain(token);

      // Step 2: User opens bot and clicks start
      const chatId = '99112233';
      const bound = db.recordChatForToken(token, chatId);
      expect(bound).toBe(true);

      // Step 3: Web app signs verification message
      const nonce = 'nonce-abc-123456';
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const message = formatLinkMessage({ token, address, nonce, expiresAt });

      const signature = await account.signMessage({ message });

      const verifyRes = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: {
          token,
          address,
          signature,
          nonce,
          expiresAt,
          watchPercent: 145.0,
        },
      });

      expect(verifyRes.statusCode).toBe(200);
      const verifyBody = JSON.parse(verifyRes.body);
      expect(verifyBody.ok).toBe(true);
      expect(verifyBody.address).toBe(address.toLowerCase());
      expect(verifyBody.chatId).toBe(chatId);

      // Verify database state
      const users = db.getTelegramUsersForAddress(address);
      expect(users.length).toBe(1);
      expect(users[0].chatId).toBe(chatId);
      expect(users[0].watchPercent).toBe(145.0);

      // Link token is consumed
      const tokenRecord = db.getLinkToken(token);
      expect(tokenRecord?.used).toBe(true);
    });

    it('rejects replay attacks with reused nonce', async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      const server = buildServer(
        {
          engine: { getState: () => ({ isRunning: true }) } as any,
          metrics,
          rpcManager: mockEoaRpcManager,
          db,
        },
        'silent',
      );

      const tokenRes = await server.inject({ method: 'POST', url: '/api/telegram/link-token' });
      const { token } = JSON.parse(tokenRes.body);
      db.recordChatForToken(token, '123456');

      const nonce = 'reused-nonce-999';
      const expiresAt = Date.now() + 600000;
      const signature = await account.signMessage({
        message: formatLinkMessage({ token, address, nonce, expiresAt }),
      });

      // First call succeeds
      const res1 = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: { token, address, signature, nonce, expiresAt },
      });
      expect(res1.statusCode).toBe(200);

      // Second call with same nonce must be rejected
      const res2 = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: { token, address, signature, nonce, expiresAt },
      });
      expect(res2.statusCode).toBe(400);
      expect(JSON.parse(res2.body).error).toContain('Signature nonce already used');
    });

    it('rejects expired signatures', async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      const server = buildServer(
        {
          engine: { getState: () => ({ isRunning: true }) } as any,
          metrics,
          rpcManager: mockEoaRpcManager,
          db,
        },
        'silent',
      );

      const tokenRes = await server.inject({ method: 'POST', url: '/api/telegram/link-token' });
      const { token } = JSON.parse(tokenRes.body);
      db.recordChatForToken(token, '123456');

      const nonce = 'expired-nonce-000';
      const expiresAt = Date.now() - 5000; // 5 seconds in past
      const signature = await account.signMessage({
        message: formatLinkMessage({ token, address, nonce, expiresAt }),
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: { token, address, signature, nonce, expiresAt },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain('Signature expired');
    });

    it('rejects invalid/tampered signatures', async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      const otherAccount = privateKeyToAccount(generatePrivateKey());

      const server = buildServer(
        {
          engine: { getState: () => ({ isRunning: true }) } as any,
          metrics,
          rpcManager: mockEoaRpcManager,
          db,
        },
        'silent',
      );

      const tokenRes = await server.inject({ method: 'POST', url: '/api/telegram/link-token' });
      const { token } = JSON.parse(tokenRes.body);
      db.recordChatForToken(token, '123456');

      const nonce = 'tampered-nonce-001';
      const expiresAt = Date.now() + 600000;

      // Signed by different key
      const badSignature = await otherAccount.signMessage({
        message: formatLinkMessage({ token, address, nonce, expiresAt }),
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: { token, address, signature: badSignature, nonce, expiresAt },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain('signature verification failed');
    });
  });

  describe('ERC-1271 Smart Account Verification', () => {
    it('verifies smart contract account via ERC-1271 isValidSignature magic value 0x1626ba7e', async () => {
      // Contract address (e.g. Mezo Passport Bitcoin smart account)
      const smartAccountAddress = '0x3333333333333333333333333333333333333333' as Address;
      const signature: Hex = '0xabcdef1234567890abcdef1234567890abcdef1234567890';
      const token = 'erc1271-test-token-123456';
      const chatId = '777888999';

      db.createLinkToken(token, Date.now() + 600000);
      db.recordChatForToken(token, chatId);

      const nonce = 'erc1271-nonce-1';
      const expiresAt = Date.now() + 600000;

      // Mock public client that recognizes smartAccountAddress as a contract with bytecode
      // and implements ERC-1271 isValidSignature returning 0x1626ba7e
      const mockPublicClient = {
        getBytecode: async ({ address }: { address: Address }) => {
          if (address.toLowerCase() === smartAccountAddress.toLowerCase()) {
            return '0x6001600055' as Hex; // contract bytecode exists!
          }
          return undefined;
        },
        readContract: async (args: any) => {
          if (args.functionName === 'isValidSignature') {
            return '0x1626ba7e'; // ERC-1271 magic value
          }
          throw new Error('Unknown function');
        },
        verifyMessage: async (args: any) => {
          const code = await mockPublicClient.getBytecode({ address: args.address });
          if (code && code !== '0x') {
            const magic = await mockPublicClient.readContract({
              address: args.address,
              functionName: 'isValidSignature',
            });
            return magic === '0x1626ba7e';
          }
          return false;
        },
      } as any;

      const server = buildServer(
        {
          engine: { getState: () => ({ isRunning: true }) } as any,
          metrics,
          rpcManager: { getPublicClient: () => mockPublicClient } as any,
          db,
        },
        'silent',
      );

      const res = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: {
          token,
          address: smartAccountAddress,
          signature,
          nonce,
          expiresAt,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
      expect(body.address).toBe(smartAccountAddress.toLowerCase());

      const user = db.getTelegramUsersForAddress(smartAccountAddress);
      expect(user.length).toBe(1);
      expect(user[0].chatId).toBe(chatId);
    });

    it('rejects smart contract account when ERC-1271 isValidSignature fails', async () => {
      const smartAccountAddress = '0x4444444444444444444444444444444444444444' as Address;
      const signature: Hex = '0x000000000000';
      const token = 'erc1271-fail-token-123456';

      db.createLinkToken(token, Date.now() + 600000);
      db.recordChatForToken(token, '999');

      const mockPublicClient = {
        verifyMessage: async () => false, // ERC-1271 returned 0xffffffff or reverted
      } as any;

      const server = buildServer(
        {
          engine: { getState: () => ({ isRunning: true }) } as any,
          metrics,
          rpcManager: { getPublicClient: () => mockPublicClient } as any,
          db,
        },
        'silent',
      );

      const res = await server.inject({
        method: 'POST',
        url: '/api/telegram/verify-link',
        payload: {
          token,
          address: smartAccountAddress,
          signature,
          nonce: 'nonce-erc1271-fail',
          expiresAt: Date.now() + 600000,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toContain('signature verification failed');
    });
  });

  describe('Web Unlink Flow', () => {
    it('unlinks wallet when provided with valid signed unlink message', async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      // Setup existing link
      db.linkTelegramUser('999888', address);
      expect(db.getTelegramUsersForAddress(address).length).toBe(1);

      const server = buildServer(
        {
          engine: { getState: () => ({ isRunning: true }) } as any,
          metrics,
          rpcManager: mockEoaRpcManager,
          db,
        },
        'silent',
      );

      const nonce = 'unlink-nonce-123';
      const expiresAt = Date.now() + 600000;
      const message = formatUnlinkMessage({ address, nonce, expiresAt });
      const signature = await account.signMessage({ message });

      const res = await server.inject({
        method: 'POST',
        url: '/api/telegram/unlink',
        payload: {
          address,
          signature,
          nonce,
          expiresAt,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).ok).toBe(true);

      // Verify address was deleted from DB
      expect(db.getTelegramUsersForAddress(address).length).toBe(0);
    });
  });
});
