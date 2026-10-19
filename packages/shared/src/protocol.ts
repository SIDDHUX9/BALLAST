/**
 * Mezo MUSD Protocol Addresses and Configuration for Mezo Testnet (Matsnet).
 * Derived directly from vendor/musd/solidity/artifacts/deployments/matsnet
 * and verified on-chain via https://rpc.test.mezo.org (Chain ID: 31611).
 */

export interface ProtocolAddresses {
  readonly chainId: number;
  readonly borrowerOperations: `0x${string}`;
  readonly troveManager: `0x${string}`;
  readonly musd: `0x${string}`;
  readonly priceFeed: `0x${string}`;
  readonly sortedTroves: `0x${string}`;
  readonly stabilityPool: `0x${string}`;
  readonly activePool: `0x${string}`;
  readonly defaultPool: `0x${string}`;
  readonly gasPool: `0x${string}`;
  readonly collSurplusPool: `0x${string}`;
  readonly hintHelpers: `0x${string}`;
  readonly borrowerOperationsSignatures: `0x${string}`;
  readonly interestRateManager: `0x${string}`;
  readonly governableVariables: `0x${string}`;
  readonly pcv: `0x${string}`;
}

export const MATSNET_PROTOCOL_ADDRESSES: ProtocolAddresses = {
  chainId: 31611,
  borrowerOperations: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5',
  troveManager: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0',
  musd: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503',
  priceFeed: '0x86bCF0841622a5dAC14A313a15f96A95421b9366',
  sortedTroves: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA',
  stabilityPool: '0x1CCA7E410eE41739792eA0A24e00349Dd247680e',
  activePool: '0x143A063F62340DA3A8bEA1C5642d18C6D0F7FF51',
  defaultPool: '0x59851D252090283f9367c159f0C9036e75483300',
  gasPool: '0x8fa3EF45137C3AFF337e42f98023C1D7dd3666C0',
  collSurplusPool: '0xB4C35747c26E4aB5F1a7CdC7E875B5946eFa6fa9',
  hintHelpers: '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6',
  borrowerOperationsSignatures: '0xD757e3646AF370b15f32EB557F0F8380Df7D639e',
  interestRateManager: '0xD4D6c36A592A2c5e86035A6bca1d57747a567f37',
  governableVariables: '0x6552059B6eFc6aA4AE3ea45f28ED4D92acE020cD',
  pcv: '0x4dDD70f4C603b6089c07875Be02fEdFD626b80Af'
} as const;

export const PROTOCOL_CONSTANTS = {
  MCR: 1100000000000000000n, // 110% (1.1e18)
  CCR: 1500000000000000000n, // 150% (1.5e18)
  MUSD_GAS_COMPENSATION: 200000000000000000000n, // 200 MUSD (200e18)
  MIN_NET_DEBT_DEFAULT: 1800000000000000000000n, // 1,800 MUSD (1800e18)
  MUSD_DECIMALS: 18,
  BTC_DECIMALS: 18
} as const;
