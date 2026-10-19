import type { Address, Hex } from 'viem';

export interface TrackedVault {
  address: Address;
  owner: Address;
  createdBlock: number;
  txHash: Hex | string;
  discoveredAt: string;
}

export interface SyncCursor {
  lastBlockNumber: number;
  updatedAt: string;
}

export interface DefenseRecord {
  id?: number;
  vault: Address;
  txHash: Hex | string;
  keeper: Address;
  blockNumber: number;
  musdRepaid: string;
  btcAdded: string;
  musdTip: string;
  btcTip: string;
  oldIcr: string;
  newIcr: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  status: 'simulated' | 'submitted' | 'confirmed' | 'failed';
  createdAt: string;
  error?: string;
}

export interface ICRSnapshot {
  vault: Address;
  icr: string;
  blockNumber: number;
  timestamp: number;
}

export interface CheckDefenseOutput {
  vault: Address;
  defendable: boolean;
  currentICR: bigint;
  musdToRepay: bigint;
  btcToAdd: bigint;
}

export interface DefenseSimulationResult {
  vault: Address;
  defendable: boolean;
  currentICR: bigint;
  musdToRepay: bigint;
  btcToAdd: bigint;
  upperHint: Address;
  lowerHint: Address;
  expectedTipMusd: bigint;
  expectedTipBtc: bigint;
  estimatedGas: bigint;
  gasPrice: bigint;
  expectedTipUsd: number;
  estimatedGasCostUsd: number;
  isProfitable: boolean;
}

export interface VaultRule {
  enabled: boolean;
  triggerICR: bigint;
  targetICR: bigint;
  maxTipBps: number;
}
