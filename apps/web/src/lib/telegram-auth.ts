import { BRAND_NAME } from '@ballast/shared';
import type { Address } from 'viem';

export function formatLinkMessage(params: {
  token: string;
  address: Address;
  nonce: string;
  expiresAt?: number;
  expiry?: number;
}): string {
  const expiryTime = params.expiresAt ?? params.expiry ?? Date.now() + 300000;
  const validTime = Number.isFinite(expiryTime) && expiryTime > 0 ? expiryTime : Date.now() + 300000;
  return [
    `Sign to link Telegram to ${BRAND_NAME}:`,
    `Token: ${params.token}`,
    `Wallet: ${params.address.toLowerCase()}`,
    `Nonce: ${params.nonce}`,
    `Expires At: ${new Date(validTime).toISOString()}`,
  ].join('\n');
}

export function formatUnlinkMessage(params: {
  address: Address;
  nonce: string;
  expiresAt?: number;
  expiry?: number;
}): string {
  const expiryTime = params.expiresAt ?? params.expiry ?? Date.now() + 300000;
  const validTime = Number.isFinite(expiryTime) && expiryTime > 0 ? expiryTime : Date.now() + 300000;
  return [
    `Sign to unlink Telegram from ${BRAND_NAME}:`,
    `Wallet: ${params.address.toLowerCase()}`,
    `Nonce: ${params.nonce}`,
    `Expires At: ${new Date(validTime).toISOString()}`,
  ].join('\n');
}
