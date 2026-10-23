import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BallastVaultAbi,
  parseDeployment,
} from '../packages/shared/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXPLORER_URL = 'https://explorer.test.mezo.org';
const RPC_URL = process.env.MEZO_RPC_URL || 'https://rpc.test.mezo.org';

async function main() {
  console.log('=== Funding BallastVault with Defense Reserves on Live Testnet ===\n');

  let rawPk =
    process.env.DEPLOYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;

  if (!rawPk) {
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/PRIVATE_KEY\s*=\s*([0-9a-fA-F]+)/);
      if (match) rawPk = match[1];
    }
  }

  if (!rawPk) {
    console.error('ERROR: Missing private key');
    process.exit(1);
  }

  const privateKey = (rawPk.startsWith('0x') ? rawPk : '0x' + rawPk).trim() as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  console.log(`Caller Address: ${account.address}`);

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

  const deploymentsPath = path.join(rootDir, 'deployments/matsnet.json');
  const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));
  const deployment = parseDeployment(deploymentData);
  const vaultAddress = '0xA506b2250B85A0c7dE80DD313A0Db9cD8a655D5A' as const;
  const musdAddress = deployment.protocol.musd;

  console.log(`Target BallastVault: ${vaultAddress}`);
  console.log(`MUSD Contract: ${musdAddress}\n`);

  async function sendTx(params: any, desc: string) {
    console.log(`Executing ${desc}...`);
    let gas = params.gas;
    if (!gas) {
      try {
        const estimated = await publicClient.estimateContractGas({ ...params, account });
        gas = (estimated * 140n) / 100n;
        if (gas < 150_000n) gas = 150_000n;
      } catch {
        gas = 400_000n;
      }
    }
    const hash = await walletClient.writeContract({ ...params, gas });
    console.log(`   Pending: ${EXPLORER_URL}/tx/${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`Tx reverted: ${hash}`);
    }
    console.log(`   Confirmed in block #${receipt.blockNumber}!\n`);
    return hash;
  }

  // 1. Approve MUSD
  const musdDeposit = parseEther('100');
  const musdAbi = parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
  ]);

  const currentAllowance = await publicClient.readContract({
    address: musdAddress,
    abi: musdAbi,
    functionName: 'allowance',
    args: [account.address, vaultAddress],
  });

  if (currentAllowance < musdDeposit) {
    await sendTx({
      address: musdAddress,
      abi: musdAbi,
      functionName: 'approve',
      args: [vaultAddress, parseEther('1000000')],
    }, 'MUSD Approval');
  }

  // 2. Deposit 100 MUSD Reserve
  await sendTx({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'depositMUSD',
    args: [musdDeposit],
  }, 'depositMUSD(100 MUSD)');

  // 3. Deposit 0.001 BTC Reserve
  const btcDeposit = parseEther('0.001');
  await sendTx({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'depositBTC',
    value: btcDeposit,
  }, 'depositBTC(0.001 BTC)');

  // 4. Verify on-chain balances
  const [musdRes, btcRes] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'musdReserve',
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'btcReserve',
    }),
  ]);

  console.log('=== On-Chain Reserves Successfully Funded ===');
  console.log(`MUSD Reserve: ${formatEther(musdRes)} MUSD`);
  console.log(`BTC Reserve: ${formatEther(btcRes)} BTC`);
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
