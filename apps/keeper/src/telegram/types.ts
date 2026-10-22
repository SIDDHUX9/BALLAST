import type { Address } from 'viem';

export interface TelegramUser {
  chatId: string;
  address: Address;
  watchPercent: number | null;
  mutedUntil: number;
  createdAt: string;
}

export interface LinkTokenRecord {
  token: string;
  chatId: string | null;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface AlertStateRecord {
  id: string; // `${vault}:${alertType}`
  vault: Address;
  alertType: string;
  armed: boolean;
  lastValue: string | null;
  lastSentAt: number;
}

export type OutboxNotificationStatus = 'pending' | 'sent' | 'failed' | 'muted';

export interface NotificationOutboxRecord {
  id: number;
  idempotencyKey: string;
  chatId: string;
  message: string;
  status: OutboxNotificationStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

export type AlertType =
  | 'warning'
  | 'defense_executed'
  | 'reserve_low'
  | 'defense_failed'
  | 'position_ended'
  | 'operational';

export interface DefenseExecutedAlertData {
  vault: Address;
  oldIcr: bigint;
  newIcr: bigint;
  musdRepaid: bigint;
  btcAdded: bigint;
  musdTip: bigint;
  btcTip: bigint;
  remainingMusd: bigint;
  remainingBtc: bigint;
  txHash: string;
}

export interface WarningAlertData {
  vault: Address;
  currentIcr: bigint;
  watchLevelPercent: number;
  triggerIcrPercent: number;
  liquidationPrice: bigint;
}

export interface ReserveLowAlertData {
  vault: Address;
  currentIcr: bigint;
  absorbableDropPercent: number;
  musdReserve: bigint;
  btcReserve: bigint;
}

export interface DefenseFailedAlertData {
  vault: Address;
  currentIcr: bigint;
  triggerIcrPercent: number;
  reason: string;
}

export interface PositionEndedAlertData {
  vault: Address;
  status: 'closedByOwner' | 'closedByLiquidation' | 'closedByRedemption';
  txHash?: string;
}

export interface OperationalAlertData {
  type: 'paused' | 'resumed';
  reason?: string;
}

export const MINIMAL_TROVE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'Troves',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [
      { name: 'debt', type: 'uint256' },
      { name: 'coll', type: 'uint256' },
      { name: 'stake', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCurrentICR',
    inputs: [
      { name: '_borrower', type: 'address' },
      { name: '_price', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
