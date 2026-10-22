import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, http, formatEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { KeeperDatabase } from '../apps/keeper/src/db.js';
import { formatLinkMessage } from '../apps/keeper/src/telegram/routes.js';
import { BallastVaultAbi, PRECISION } from '../packages/shared/dist/index.js';

for (const p of ['.env', '../../.env', '../.env']) {
  const full = path.resolve(process.cwd(), p);
  if (fs.existsSync(full) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(full);
    } catch {}
  }
}

const db = new KeeperDatabase('ballast-keeper.db');

const rawPk = (process.env.PRIVATE_KEY || '').trim();
const privateKey = (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) as `0x${string}`;

const account = privateKeyToAccount(privateKey);
const userAddress = account.address;
const vaultAddress = '0xA506b2250B85A0c7dE80DD313A0Db9cD8a655D5A' as Address;

const token = process.argv[2] || 'cd6bd8431eb88ea046ba1c0e38ee0be3';

async function main() {
  console.log(`Checking link token status for: ${token}`);
  const record = db.getLinkToken(token);
  console.log('Token record in DB:', record);

  if (!record) {
    console.error('Token not found in DB!');
    process.exit(1);
  }

  if (!record.chatId) {
    console.log(`\nWaiting for user to open the bot link and tap Start:\nhttps://t.me/BALLASTBTC_bot?start=${token}\n`);
    return;
  }

  console.log(`\nChat ID detected: ${record.chatId}! Proceeding with wallet signature...`);

  // Sign verification message
  const nonce = `e2e-nonce-${Date.now()}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const message = formatLinkMessage({
    token,
    address: userAddress,
    nonce,
    expiresAt,
  });

  const signature = await account.signMessage({ message });
  console.log('Signature generated for wallet:', userAddress);

  // Submit to verify-link endpoint
  const res = await fetch('http://127.0.0.1:3001/api/telegram/verify-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      address: userAddress,
      signature,
      nonce,
      expiresAt,
    }),
  });

  const json = await res.json();
  console.log('verify-link HTTP response:', json);

  if (!res.ok) {
    console.error('Failed to link:', json);
    process.exit(1);
  }

  console.log('\nWallet successfully linked to Telegram chat!');

  // Now inspect real on-chain position
  const publicClient = createPublicClient({ transport: http('https://rpc.test.mezo.org') });
  const checkDefense = await publicClient.readContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'checkDefense',
  });

  const liveIcrPct = Number((checkDefense[1] * 10000n) / PRECISION) / 100;
  console.log(`Real On-Chain ICR for vault ${vaultAddress}: ${liveIcrPct.toFixed(2)}%`);

  // Force warning condition by setting watch level above current ICR
  const chosenWatchLevel = Math.max(160, Math.ceil(liveIcrPct) + 15);
  console.log(`Setting custom watch level to: ${chosenWatchLevel}% (forcing warning condition using real testnet state)`);

  db.updateWatchPercent(record.chatId, chosenWatchLevel);
  console.log(`Updated watch percent in database for chat ${record.chatId} to ${chosenWatchLevel}%`);
}

main().catch(console.error);
