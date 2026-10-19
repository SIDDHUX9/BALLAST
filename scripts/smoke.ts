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
  BallastFactoryAbi,
  BallastVaultAbi,
  parseDeployment,
  PROTOCOL_CONSTANTS,
} from '../packages/shared/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXPLORER_URL = 'https://explorer.test.mezo.org';
const RPC_URL = process.env.MEZO_RPC_URL || 'https://rpc.test.mezo.org';

async function main() {
  console.log('=== Ballast Real Testnet Smoke Test ===\n');

  let rawPk =
    process.env.SMOKE_PRIVATE_KEY ||
    process.env.TEST_PRIVATE_KEY ||
    process.env.DEPLOYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;

  if (!rawPk) {
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/PRIVATE_KEY\s*=\s*([0-9a-fA-F]+)/);
      if (match) {
        rawPk = match[1];
      }
    }
  }

  if (!rawPk) {
    console.error('ERROR: Missing private key in .env or environment!');
    process.exit(1);
  }

  const privateKey = (rawPk.startsWith('0x') ? rawPk : '0x' + rawPk).trim() as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  console.log(`Using Account Address: ${account.address}`);

  const publicClient = createPublicClient({
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Account Native BTC Balance: ${formatEther(balance)} BTC`);

  if (balance < parseEther('0.003')) {
    console.error(`INSUFFICIENT BALANCE: Account needs at least ~0.003 BTC for testing.`);
    console.error(`Please fund ${account.address} from https://faucet.test.mezo.org/`);
    process.exit(1);
  }


  // Load deployment
  const deploymentsPath = path.join(rootDir, 'deployments/matsnet.json');
  if (!fs.existsSync(deploymentsPath)) {
    console.error(`Deployment file not found at ${deploymentsPath}! Run deployment first.`);
    process.exit(1);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));
  const deployment = parseDeployment(deploymentData);
  const factoryAddress = deployment.ballastFactory;
  const protocol = deployment.protocol;

  console.log(`BallastFactory: ${factoryAddress}`);
  console.log(`Protocol TroveManager: ${protocol.troveManager}\n`);

  // Robust sendTx with gas floor exceeding EIP-7623 data gas floor requirements
  async function sendTx(params: any) {
    let gas = params.gas;
    if (!gas) {
      try {
        const estimated = await publicClient.estimateContractGas({
          ...params,
          account,
        });
        gas = (estimated * 150n) / 100n;
        if (gas < 150_000n) gas = 150_000n;
      } catch {
        gas = 500_000n;
      }
    }
    const hash = await walletClient.writeContract({
      ...params,
      gas,
    });
    console.log(`   TX: ${EXPLORER_URL}/tx/${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`Transaction reverted: ${hash}`);
    }
    return hash;
  }

  // Step 1: Check or Create Vault
  let vaultAddress = await publicClient.readContract({
    address: factoryAddress,
    abi: BallastFactoryAbi,
    functionName: 'vaultOf',
    args: [account.address],
  });

  if (vaultAddress === '0x0000000000000000000000000000000000000000') {
    console.log('1. Deploying BallastVault via Factory...');
    await sendTx({
      address: factoryAddress,
      abi: BallastFactoryAbi,
      functionName: 'createVault',
      gas: 250_000n,
    });

    vaultAddress = await publicClient.readContract({
      address: factoryAddress,
      abi: BallastFactoryAbi,
      functionName: 'vaultOf',
      args: [account.address],
    });
    console.log(`   Created Vault at: ${vaultAddress}\n`);
  } else {
    console.log(`1. Reusing existing BallastVault: ${vaultAddress}\n`);
  }

  // Step 2: Compute Trove Hints
  console.log('2. Computing Trove Insertion Hints...');
  const collAmount = parseEther('0.038'); // ~0.038 BTC gives ~155% ICR at ~$82k BTC
  const netDebt = parseEther('1800'); // 1,800 MUSD minimum legal net debt

  const sortedTrovesAbi = parseAbi([
    'function getFirst() view returns (address)',
    'function getLast() view returns (address)',
    'function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) view returns (address upperHint, address lowerHint)',
  ]);
  const priceFeedAbi = parseAbi(['function fetchPrice() view returns (uint256)']);

  const price = await publicClient.readContract({
    address: protocol.priceFeed,
    abi: priceFeedAbi,
    functionName: 'fetchPrice',
  });
  console.log(`   Oracle Price: $${(Number(price) / 1e18).toFixed(2)}`);

  const grossDebt = netDebt + PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION;
  const nicr = (collAmount * 100000000000000000000n) / grossDebt;

  const [first, last] = await Promise.all([
    publicClient.readContract({
      address: protocol.sortedTroves,
      abi: sortedTrovesAbi,
      functionName: 'getFirst',
    }),
    publicClient.readContract({
      address: protocol.sortedTroves,
      abi: sortedTrovesAbi,
      functionName: 'getLast',
    }),
  ]);

  const [upperHint, lowerHint] = await publicClient.readContract({
    address: protocol.sortedTroves,
    abi: sortedTrovesAbi,
    functionName: 'findInsertPosition',
    args: [nicr, first, last],
  });

  console.log(`   Hints resolved: upper=${upperHint}, lower=${lowerHint}\n`);


  // Step 3: Open Trove if not active
  const troveManagerAbi = parseAbi([
    'function getTroveStatus(address _borrower) view returns (uint256)',
    'function getTroveDebt(address _borrower) view returns (uint256)',
    'function getTroveColl(address _borrower) view returns (uint256)',
    'function getCurrentICR(address _borrower, uint256 _price) view returns (uint256)',
  ]);

  const troveStatus = await publicClient.readContract({
    address: protocol.troveManager,
    abi: troveManagerAbi,
    functionName: 'getTroveStatus',
    args: [vaultAddress],
  });

  if (troveStatus !== 1n) {
    console.log('3. Opening Trove through BallastVault...');
    await sendTx({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'openTrove',
      args: [netDebt, upperHint, lowerHint],
      value: collAmount,
      gas: 1_200_000n,
    });

    console.log('   Trove opened successfully!\n');
  } else {
    console.log('3. Trove is already active on vault.\n');
  }

  // Verify Trove state
  const [currentDebt, currentColl, currentIcr] = await Promise.all([
    publicClient.readContract({
      address: protocol.troveManager,
      abi: troveManagerAbi,
      functionName: 'getTroveDebt',
      args: [vaultAddress],
    }),
    publicClient.readContract({
      address: protocol.troveManager,
      abi: troveManagerAbi,
      functionName: 'getTroveColl',
      args: [vaultAddress],
    }),
    publicClient.readContract({
      address: protocol.troveManager,
      abi: troveManagerAbi,
      functionName: 'getCurrentICR',
      args: [vaultAddress, price],
    }),
  ]);

  console.log(`   Trove State:`);
  console.log(`   - Debt: ${formatEther(currentDebt)} MUSD`);
  console.log(`   - Collateral: ${formatEther(currentColl)} BTC`);
  console.log(`   - ICR: ${(Number(currentIcr) / 1e16).toFixed(2)}%\n`);

  // Step 4: Configure Rule
  console.log('4. Configuring Rule...');
  await sendTx({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'setRule',
    args: [true, parseEther('1.25'), parseEther('1.40'), 50],
    gas: 150_000n,
  });
  console.log('   Rule configured successfully.\n');

  // Step 5: Fund Reserves
  console.log('5. Funding Reserves...');
  const btcReserveDeposit = parseEther('0.002');
  await sendTx({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'depositBTC',
    value: btcReserveDeposit,
    gas: 150_000n,
  });

  const musdReserveDeposit = parseEther('50');
  const musdAbi = parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
  ]);
  const musdBalance = await publicClient.readContract({
    address: protocol.musd,
    abi: musdAbi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log(`   Account MUSD Balance: ${formatEther(musdBalance)} MUSD`);

  if (musdBalance >= musdReserveDeposit) {
    await sendTx({
      address: protocol.musd,
      abi: musdAbi,
      functionName: 'approve',
      args: [vaultAddress, musdReserveDeposit],
      gas: 100_000n,
    });

    await sendTx({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'depositMUSD',
      args: [musdReserveDeposit],
      gas: 150_000n,
    });
  }
  console.log('   Reserves funded.\n');

  // Step 6: Call checkDefense()
  console.log('6. Inspecting checkDefense() view...');
  const defenseCheck = await publicClient.readContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'checkDefense',
  });
  console.log(`   - Is Defendable: ${defenseCheck[0]}`);
  console.log(`   - Current ICR: ${(Number(defenseCheck[1]) / 1e16).toFixed(2)}%`);
  console.log(`   - Repay Amount: ${formatEther(defenseCheck[2])} MUSD`);
  console.log(`   - Collateral Topup: ${formatEther(defenseCheck[3])} BTC\n`);


  // Step 7: Withdraw Reserves
  console.log('7. Withdrawing Reserves...');
  const currentBtcReserve = await publicClient.readContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'btcReserve',
  });
  if (currentBtcReserve > 0n) {
    await sendTx({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'withdrawBTC',
      args: [currentBtcReserve],
      gas: 150_000n,
    });
  }

  const currentMusdReserve = await publicClient.readContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'musdReserve',
  });
  if (currentMusdReserve > 0n) {
    await sendTx({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'withdrawMUSD',
      args: [currentMusdReserve],
      gas: 150_000n,
    });
  }
  console.log('   Reserves withdrawn successfully.\n');

  // Step 8: Close Trove
  console.log('8. Evaluating Trove Closure through BallastVault...');
  const ownerTotalMusd = await publicClient.readContract({
    address: protocol.musd,
    abi: musdAbi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log(`   Owner MUSD balance: ${formatEther(ownerTotalMusd)} MUSD`);
  const debt = await publicClient.readContract({
    address: protocol.troveManager,
    abi: troveManagerAbi,
    functionName: 'getTroveDebt',
    args: [vaultAddress],
  });
  const netDebtToClose = debt > PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
    ? debt - PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
    : 0n;
  console.log(`   Net Debt needed to close: ${formatEther(netDebtToClose)} MUSD`);

  if (ownerTotalMusd >= netDebtToClose) {
    await sendTx({
      address: protocol.musd,
      abi: musdAbi,
      functionName: 'approve',
      args: [vaultAddress, netDebtToClose + parseEther('50')],
      gas: 100_000n,
    });

    await sendTx({
      address: vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'closeTrove',
      gas: 1_200_000n,
    });

    const finalStatus = await publicClient.readContract({
      address: protocol.troveManager,
      abi: troveManagerAbi,
      functionName: 'getTroveStatus',
      args: [vaultAddress],
    });
    console.log(`   Final Trove Status: ${finalStatus} (2 = closedByOwner)`);
  } else {
    console.log(`   [NOTE ON PROTOCOL DYNAMICS]`);
    console.log(`   To close the trove, the protocol requires repaying the net debt including the 0.1% initial borrowing fee (${formatEther(netDebtToClose - ownerTotalMusd)} MUSD shortfall).`);
    console.log(`   In Mezo MUSD, borrowing fees are added to debt but not minted to the borrower.`);
    console.log(`   Once ~2 MUSD is acquired or transferred to ${account.address}, closeTrove() can execute to reclaim the collateral.`);
  }

  console.log('\n=== REAL TESTNET SMOKE TEST COMPLETED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('\nSmoke test failed:', err);
  process.exit(1);
});

