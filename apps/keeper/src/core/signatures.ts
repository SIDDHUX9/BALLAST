import { z } from 'zod';
import type { Address, Hex, PublicClient } from 'viem';
import { BRAND_NAME } from '@ballast/shared';
import type { StoreInterface } from './types.js';

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

export const VerifyLinkInputSchema = z.object({
  token: z.string().min(16),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((v) => v.toLowerCase() as Address),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/).transform((v) => v as Hex),
  nonce: z.string().min(8),
  expiresAt: z.number().int().positive(),
  watchPercent: z.number().min(110).max(500).optional(),
});

export type VerifyLinkInput = z.infer<typeof VerifyLinkInputSchema>;

export const UnlinkInputSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((v) => v.toLowerCase() as Address),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/).transform((v) => v as Hex),
  nonce: z.string().min(8),
  expiresAt: z.number().int().positive(),
});

export type UnlinkInput = z.infer<typeof UnlinkInputSchema>;

export interface VerifyLinkResult {
  ok: boolean;
  chatId?: string;
  address?: Address;
  error?: string;
}

export async function verifyAndProcessLink(
  publicClient: PublicClient,
  store: StoreInterface,
  input: VerifyLinkInput,
  now: number = Date.now(),
): Promise<VerifyLinkResult> {
  const { token, address, signature, nonce, expiresAt, watchPercent } = input;

  // 1. Check signature expiration
  if (expiresAt <= now) {
    return { ok: false, error: 'Signature expired' };
  }

  // 2. Check and consume nonce for replay protection
  const nonceAccepted = await store.useSignatureNonce(nonce, address, now);
  if (!nonceAccepted) {
    return { ok: false, error: 'Signature nonce already used (replay rejected)' };
  }

  // 3. Validate link token state
  const tokenRecord = await store.getLinkToken(token);
  if (!tokenRecord) {
    return { ok: false, error: 'Link token not found' };
  }
  if (tokenRecord.used) {
    return { ok: false, error: 'Link token already used' };
  }
  if (tokenRecord.expiresAt <= now) {
    return { ok: false, error: 'Link token expired' };
  }
  if (!tokenRecord.chatId) {
    return {
      ok: false,
      error: 'Pending chat ID not found. Please click Start in the Telegram bot first.',
    };
  }

  // 4. Verify EIP-191 / ERC-1271 signature via viem
  const expectedMessage = formatLinkMessage({ token, address, nonce, expiresAt });
  try {
    const isValid = await publicClient.verifyMessage({
      address,
      message: expectedMessage,
      signature,
    });

    if (!isValid) {
      return { ok: false, error: 'Cryptographic signature verification failed' };
    }
  } catch (err: any) {
    return {
      ok: false,
      error: `Signature verification error: ${err.message || 'unknown'}`,
    };
  }

  // 5. Consume token and bind wallet to chat
  await store.markLinkTokenUsed(token);
  await store.linkTelegramUser(tokenRecord.chatId, address, watchPercent);

  return { ok: true, chatId: tokenRecord.chatId, address };
}

export async function verifyAndProcessUnlink(
  publicClient: PublicClient,
  store: StoreInterface,
  input: UnlinkInput,
  now: number = Date.now(),
): Promise<{ ok: boolean; error?: string }> {
  const { address, signature, nonce, expiresAt } = input;

  if (expiresAt <= now) {
    return { ok: false, error: 'Signature expired' };
  }

  const nonceAccepted = await store.useSignatureNonce(nonce, address, now);
  if (!nonceAccepted) {
    return { ok: false, error: 'Signature nonce already used (replay rejected)' };
  }

  const expectedMessage = formatUnlinkMessage({ address, nonce, expiresAt });
  try {
    const isValid = await publicClient.verifyMessage({
      address,
      message: expectedMessage,
      signature,
    });

    if (!isValid) {
      return { ok: false, error: 'Cryptographic signature verification failed' };
    }
  } catch (err: any) {
    return {
      ok: false,
      error: `Signature verification error: ${err.message || 'unknown'}`,
    };
  }

  await store.unlinkTelegramUser(address);
  return { ok: true };
}
