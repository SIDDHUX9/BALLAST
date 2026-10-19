#!/usr/bin/env tsx
/**
 * Standalone manual defense script for Ballast vaults.
 * Proves that Ballast defense execution is 100% permissionless and does NOT depend on any central keeper.
 *
 * Usage:
 *   npx tsx scripts/defend-manually.ts --vault <VAULT_ADDRESS> [--rpc <RPC_URL>] [--dry-run]
 *
 * Requires PRIVATE_KEY in environment or via --key argument.
 */

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEventLogs,
  type Address,
  type Hex,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BallastVaultAbi,
  MATSNET_PROTOCOL_ADDRESSES,
  BRAND_NAME,
} from '../packages/shared/src/index.js';

const SORTED_TROVES_ABI = [
  {
    type: 'function',
    name: 'getFirst',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLast',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'findInsertPosition',
    inputs: [
      { name: '_NICR', type: 'uint256' },
      { name: '_prevId', type: 'address' },
      { name: '_nextId', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
    ],
    stateMutability: 'view',
  },
] as const;

const TROVE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getEntireDebtAndColl',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [
      { name: 'coll', type: 'uint256' },
      { name: 'principal', type: 'uint256' },
      { name: 'interest', type: 'uint256' },
      { name: 'pendingCollateral', type: 'uint256' },
      { name: 'pendingPrincipal', type: 'uint256' },
      { name: 'pendingInterest', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      vault: { type: 'string' },
      rpc: { type: 'string', default: 'https://rpc.test.mezo.org' },
      key: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const vaultAddress = (values.vault || process.env.BALLAST_VAULT_ADDRESS) as Address;
  if (!vaultAddress || !vaultAddress.startsWith('0x') || vaultAddress.length !== 42) {
    console.error('Error: Please provide a valid --vault <address>');
    process.exit(1);
  }

  const isDryRun = Boolean(values['dry-run']);

  // Load private key
  let rawKey = values.key || process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!rawKey) {
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(/PRIVATE_KEY\s*=\s*(0x)?[0-9a-fA-F]{64}/);
      if (match) rawKey = match[0].split('=')[1]?.trim();
    }
  }

  if (rawKey && !rawKey.startsWith('0x')) {
    rawKey = `0x${rawKey}`;
  }

  if (!rawKey && isDryRun) {
    rawKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
  }

  if (!rawKey) {
    console.error('Error: No private key found. Provide --key 0x... or set PRIVATE_KEY in .env');
    process.exit(1);
  }

  const privateKey = rawKey.trim() as Hex;
  const account = privateKeyToAccount(privateKey);
  const rpcUrl = values.rpc || 'https://rpc.test.mezo.org';

  console.log(`\n======================================================`);
  console.log(`   ${BRAND_NAME} - Permissionless Manual Defense Tool`);
  console.log(`======================================================\n`);
  console.log(`Target Vault:   ${vaultAddress}`);
  console.log(`Caller Address: ${account.address}`);
  console.log(`RPC Endpoint:   ${rpcUrl}`);
  console.log(`Execution Mode: ${isDryRun ? 'DRY-RUN (Simulate Only)' : 'LIVE EXECUTION'}\n`);

  const chain = {
    id: 31611,
    name: 'Mezo Testnet',
    nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
    rpcUrls: { default: { http: [rpcUrl] } },
  };

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  // 1. Check Defense Eligibility
  console.log('Querying checkDefense() on vault...');
  const [defendable, currentICR, musdToRepay, btcToAdd] = await publicClient.readContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'checkDefense',
  });

  const icrPercent = Number((currentICR * 10000n) / 10n ** 18n) / 100;
  console.log(`Current Vault ICR: ${icrPercent.toFixed(2)}% (${currentICR.toString()})`);
  console.log(`Defendable Status: ${defendable ? 'YES - ACTION REQUIRED' : 'NO'}`);
  console.log(`MUSD to Repay:     ${formatEther(musdToRepay)} MUSD`);
  console.log(`BTC to Add:        ${formatEther(btcToAdd)} BTC\n`);

  if (!defendable) {
    console.log('Result: Vault does not require defense at this time (ICR is above trigger or reserves depleted).');
    process.exit(0);
  }

  // 2. Compute Hints
  console.log('Computing off-chain insertion hints from SortedTroves...');
  let upperHint: Address = zeroAddress;
  let lowerHint: Address = zeroAddress;

  try {
    const troveRes = await publicClient.readContract({
      address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
      abi: TROVE_MANAGER_ABI,
      functionName: 'getEntireDebtAndColl',
      args: [vaultAddress],
    });

    const totalColl = troveRes[0] + troveRes[3] + btcToAdd;
    const totalDebt = troveRes[1] + troveRes[2] + troveRes[4] + troveRes[5] - musdToRepay;

    if (totalDebt > 0n) {
      const nicr = (totalColl * 10n ** 20n) / totalDebt;
      const [first, last] = await Promise.all([
        publicClient.readContract({
          address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
          abi: SORTED_TROVES_ABI,
          functionName: 'getFirst',
        }),
        publicClient.readContract({
          address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
          abi: SORTED_TROVES_ABI,
          functionName: 'getLast',
        }),
      ]);

      const hints = await publicClient.readContract({
        address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
        abi: SORTED_TROVES_ABI,
        functionName: 'findInsertPosition',
        args: [nicr, first, last],
      });

      upperHint = hints[0];
      lowerHint = hints[1];
    }
  } catch (err) {
    console.warn('Hint computation fell back to zero address hints:', err);
  }

  console.log(`Computed Upper Hint: ${upperHint}`);
  console.log(`Computed Lower Hint: ${lowerHint}\n`);

  // 3. Simulate defend()
  console.log('Simulating defend(upperHint, lowerHint) with eth_call...');
  await publicClient.simulateContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'defend',
    args: [upperHint, lowerHint],
    account: account.address,
  });
  console.log('Simulation SUCCESSFUL: defense transaction is valid and will execute.\n');

  if (isDryRun) {
    console.log('[DRY-RUN] Simulation verified successfully. Exiting without broadcasting.');
    process.exit(0);
  }

  // 4. Execute Transaction
  console.log('Broadcasting defend() transaction to Mezo testnet...');
  const txHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: BallastVaultAbi,
    functionName: 'defend',
    args: [upperHint, lowerHint],
    gas: 950000n,
    chain,
    account,
  });

  console.log(`Transaction submitted: ${txHash}`);
  console.log('Waiting for block confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  console.log(`\nTransaction Confirmed in block #${receipt.blockNumber}! Gas Used: ${receipt.gasUsed}`);

  const defLogs = parseEventLogs({
    abi: BallastVaultAbi,
    eventName: 'Defended',
    logs: receipt.logs,
  });

  if (defLogs.length > 0) {
    const l = defLogs[0].args;
    const oldPercent = Number((l.oldICR * 10000n) / 10n ** 18n) / 100;
    const newPercent = Number((l.newICR * 10000n) / 10n ** 18n) / 100;

    console.log(`\n================ DEFENSE SUMMARY ================`);
    console.log(`Old ICR:      ${oldPercent.toFixed(2)}%`);
    console.log(`New ICR:      ${newPercent.toFixed(2)}% (Trove Protected!)`);
    console.log(`MUSD Repaid:  ${formatEther(l.musdRepaid)} MUSD`);
    console.log(`BTC Added:    ${formatEther(l.btcAdded)} BTC`);
    console.log(`MUSD Tip:     ${formatEther(l.musdTip)} MUSD (paid to caller)`);
    console.log(`BTC Tip:      ${formatEther(l.btcTip)} BTC (paid to caller)`);
    console.log(`=================================================\n`);
  } else {
    console.log('Defense executed successfully.');
  }
}

main().catch((err) => {
  console.error('\nDefense Failed:', err);
  process.exit(1);
});
