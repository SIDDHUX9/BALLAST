import fs from 'node:fs';
import path from 'node:path';
import { privateKeyToAccount } from 'viem/accounts';
import { formatLinkMessage } from '../apps/keeper/src/telegram/routes.js';

for (const p of ['.env', '../../.env', '../.env']) {
  const full = path.resolve(process.cwd(), p);
  if (fs.existsSync(full) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(full);
    } catch {}
  }
}

const rawPk = (process.env.PRIVATE_KEY || '').trim();
const privateKey = (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) as `0x${string}`;

const account = privateKeyToAccount(privateKey);
const userAddress = account.address;
const token = process.argv[2] || 'cd6bd8431eb88ea046ba1c0e38ee0be3';

async function attemptLink(): Promise<boolean> {
  const nonce = `e2e-nonce-${Date.now()}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const message = formatLinkMessage({
    token,
    address: userAddress,
    nonce,
    expiresAt,
  });

  const signature = await account.signMessage({ message });

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

  const body = await res.json();
  if (res.ok) {
    console.log('SUCCESS: Telegram linked successfully!');
    console.log('Bound details:', body);
    return true;
  } else {
    console.log(`Waiting for bot start... Server reply: ${body.error}`);
    return false;
  }
}

async function loop() {
  console.log(`Checking link for wallet ${userAddress} with token ${token}...`);
  for (let i = 0; i < 300; i++) {
    const success = await attemptLink();
    if (success) {
      console.log('\nReady to test bot commands on your phone:');
      console.log('1. /status - will display live on-chain ICR and liquidation price');
      console.log('2. /watch 180 - sets watch level to force warning alert');
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('Timed out waiting for Start button press.');
}

loop().catch(console.error);
