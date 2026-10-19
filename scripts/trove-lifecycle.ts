import { createWalletClient, createPublicClient, http, formatUnits } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { MEZO_TESTNET_ADDRESSES } from '../packages/shared/src/protocol.js';

// If TEST_PRIVATE_KEY is provided in environment, use it; otherwise generate a fresh burner
const privateKey = (process.env.TEST_PRIVATE_KEY as `0x${string}`) || generatePrivateKey();
const account = privateKeyToAccount(privateKey);

const client = createPublicClient({
  transport: http('https://rpc.test.mezo.org'),
});

const _wallet = createWalletClient({
  account,
  transport: http('https://rpc.test.mezo.org'),
});

// Suppress unused warning while keeping reference to verified addresses
void MEZO_TESTNET_ADDRESSES;
void _wallet;

async function main() {
  console.log('=== Ballast Empirical Trove Lifecycle ===\n');
  console.log(`Burner Address: ${account.address}`);
  console.log(`Private Key: ${privateKey}\n`);

  const balance = await client.getBalance({ address: account.address });
  console.log(`Current Balance: ${formatUnits(balance, 18)} BTC`);

  if (balance === 0n) {
    console.log('\n[ACTION REQUIRED] This burner account has 0 BTC.');
    console.log(`Please request testnet BTC from the Mezo faucet to: ${account.address}`);
    console.log('Then re-run this script with:');
    console.log(`$env:TEST_PRIVATE_KEY="${privateKey}"; pnpm exec tsx scripts/trove-lifecycle.ts`);
    return;
  }

  console.log('Account is funded. Ready to execute lifecycle operations...');
}

main().catch(console.error);
