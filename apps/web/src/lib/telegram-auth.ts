import { BRAND_NAME } from '@ballast/shared';
import type { Address } from 'viem';

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
