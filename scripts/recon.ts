import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { BRAND_NAME } from '../packages/shared/src/brand.js';

// Official testnet (Matsnet) deployed addresses verified from artifacts & on-chain
export const MEZO_TESTNET_ADDRESSES = {
  BorrowerOperations: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5' as const,
  TroveManager: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0' as const,
  MUSD: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as const,
  PriceFeed: '0x86bCF0841622a5dAC14A313a15f96A95421b9366' as const,
  SortedTroves: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA' as const,
  StabilityPool: '0x1CCA7E410eE41739792eA0A24e00349Dd247680e' as const,
  ActivePool: '0x143A063F62340DA3A8bEA1C5642d18C6D0F7FF51' as const,
  DefaultPool: '0x59851D252090283f9367c159f0C9036e75483300' as const,
  GasPool: '0x8fa3EF45137C3AFF337e42f98023C1D7dd3666C0' as const,
  CollSurplusPool: '0xB4C35747c26E4aB5F1a7CdC7E875B5946eFa6fa9' as const,
  HintHelpers: '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6' as const,
  BorrowerOperationsSignatures: '0xD757e3646AF370b15f32EB557F0F8380Df7D639e' as const,
  InterestRateManager: '0xD4D6c36A592A2c5e86035A6bca1d57747a567f37' as const,
  GovernableVariables: '0x6552059B6eFc6aA4AE3ea45f28ED4D92acE020cD' as const,
  PCV: '0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af' as const
};

async function runRecon() {
  console.log(`=== ${BRAND_NAME} Protocol Reconnaissance ===\n`);

  const client = createPublicClient({
    transport: http('https://rpc.test.mezo.org')
  });

  const chainId = await client.getChainId();
  console.log(`Network: Mezo Testnet (Matsnet)`);
  console.log(`RPC Chain ID: ${chainId} (0x${chainId.toString(16)})\n`);

  // MUSD
  const musdAbi = parseAbi([
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ]);
  const [musdName, musdSymbol, musdDecimals, musdSupply] = await Promise.all([
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.MUSD, abi: musdAbi, functionName: 'name' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.MUSD, abi: musdAbi, functionName: 'symbol' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.MUSD, abi: musdAbi, functionName: 'decimals' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.MUSD, abi: musdAbi, functionName: 'totalSupply' })
  ]);
  console.log(`MUSD Token: ${musdName} (${musdSymbol})`);
  console.log(`MUSD Address: ${MEZO_TESTNET_ADDRESSES.MUSD}`);
  console.log(`MUSD Decimals: ${musdDecimals}`);
  console.log(`MUSD Total Supply: ${formatUnits(musdSupply, musdDecimals)} MUSD\n`);

  // PriceFeed
  const pfAbi = parseAbi([
    'function fetchPrice() view returns (uint256)',
    'function oracle() view returns (address)'
  ]);
  const [btcPriceWei, oracleAddress] = await Promise.all([
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.PriceFeed, abi: pfAbi, functionName: 'fetchPrice' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.PriceFeed, abi: pfAbi, functionName: 'oracle' })
  ]);
  console.log(`PriceFeed Address: ${MEZO_TESTNET_ADDRESSES.PriceFeed}`);
  console.log(`Underlying Oracle Address: ${oracleAddress}`);
  console.log(`Live BTC Price: $${Number(formatUnits(btcPriceWei, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (${btcPriceWei.toString()} wei)\n`);

  // TroveManager Constants & TCR
  const tmAbi = parseAbi([
    'function MCR() view returns (uint256)',
    'function CCR() view returns (uint256)',
    'function getTCR(uint256 _price) view returns (uint256)',
    'function checkRecoveryMode(uint256 _price) view returns (bool)',
    'function getEntireSystemColl() view returns (uint256)',
    'function getEntireSystemDebt() view returns (uint256)',
    'function getTroveOwnersCount() view returns (uint256)'
  ]);

  const [mcr, ccr, tcr, isRecovery, sysColl, sysDebt, troveCount] = await Promise.all([
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'MCR' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'CCR' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'getTCR', args: [btcPriceWei] }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'checkRecoveryMode', args: [btcPriceWei] }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'getEntireSystemColl' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'getEntireSystemDebt' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.TroveManager, abi: tmAbi, functionName: 'getTroveOwnersCount' })
  ]);

  console.log(`TroveManager Address: ${MEZO_TESTNET_ADDRESSES.TroveManager}`);
  console.log(`MCR (Minimum Collateral Ratio): ${(Number(mcr) / 1e16).toFixed(0)}% (${mcr.toString()} wei)`);
  console.log(`CCR (Critical Collateral Ratio): ${(Number(ccr) / 1e16).toFixed(0)}% (${ccr.toString()} wei)`);
  console.log(`Active Troves Count: ${troveCount.toString()}`);
  console.log(`Entire System Collateral: ${formatUnits(sysColl, 18)} BTC`);
  console.log(`Entire System Debt: ${formatUnits(sysDebt, 18)} MUSD`);
  console.log(`TCR (Total Collateral Ratio): ${(Number(tcr) / 1e16).toFixed(2)}% (${tcr.toString()} wei)`);
  console.log(`Recovery Mode Active: ${isRecovery ? 'YES (TCR < CCR)' : 'NO (Normal Mode, TCR >= CCR)'}\n`);

  // BorrowerOperations Constants & Fees
  const boAbi = parseAbi([
    'function minNetDebt() view returns (uint256)',
    'function borrowingRate() view returns (uint256)',
    'function getBorrowingFee(uint256 _debt) view returns (uint256)',
    'function MUSD_GAS_COMPENSATION() view returns (uint256)'
  ]);

  const sampleDebt = 2000n * 10n ** 18n; // 2,000 MUSD sample debt
  const [minNetDebt, borrowingRate, sampleFee, gasCompensation] = await Promise.all([
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.BorrowerOperations, abi: boAbi, functionName: 'minNetDebt' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.BorrowerOperations, abi: boAbi, functionName: 'borrowingRate' }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.BorrowerOperations, abi: boAbi, functionName: 'getBorrowingFee', args: [sampleDebt] }),
    client.readContract({ address: MEZO_TESTNET_ADDRESSES.BorrowerOperations, abi: boAbi, functionName: 'MUSD_GAS_COMPENSATION' })
  ]);

  console.log(`BorrowerOperations Address: ${MEZO_TESTNET_ADDRESSES.BorrowerOperations}`);
  console.log(`Min Net Debt: ${formatUnits(minNetDebt, 18)} MUSD (${minNetDebt.toString()} wei)`);
  console.log(`Gas Compensation (Liquidation Reserve): ${formatUnits(gasCompensation, 18)} MUSD (${gasCompensation.toString()} wei)`);
  console.log(`Borrowing Rate: ${(Number(borrowingRate) / 1e16).toFixed(2)}% (${borrowingRate.toString()} wei)`);
  console.log(`Sample Borrowing Fee for 2,000 MUSD: ${formatUnits(sampleFee, 18)} MUSD (${sampleFee.toString()} wei)\n`);
  console.log(`=== Verification Complete ===`);
}

runRecon().catch(console.error);
