import type { Address, Hex, PublicClient, WalletClient } from 'viem';
import type {
  TrackedVault,
  DefenseRecord,
  ICRSnapshot,
  CheckDefenseOutput,
  VaultRule,
} from '../types.js';
import type {
  TelegramUser,
  LinkTokenRecord,
  AlertStateRecord,
} from '../telegram/types.js';

export interface OutboxNotification {
  idempotencyKey: string;
  chatId: string;
  message: string;
}

export interface StoreInterface {
  getCursor(): Promise<number | null> | number | null;
  saveCursor(blockNumber: number): Promise<void> | void;
  saveVault(vault: TrackedVault): Promise<void> | void;
  getAllVaults(): Promise<TrackedVault[]> | TrackedVault[];
  getVaultCount(): Promise<number> | number;
  saveDefense(record: DefenseRecord): Promise<any> | any;
  getAlertState(vault: Address, alertType: string): Promise<AlertStateRecord | null> | AlertStateRecord | null;
  setAlertState(
    vault: Address,
    alertType: string,
    armed: boolean,
    lastValue: string | null,
    lastSentAt: number,
  ): Promise<void> | void;
  queueNotification(notification: OutboxNotification): Promise<void> | void;
  saveIcrSnapshot(snapshot: ICRSnapshot): Promise<void> | void;
  getTelegramUsersForAddress(address: Address): Promise<TelegramUser[]> | TelegramUser[];
  getTelegramUsersForVault(vault: Address): Promise<TelegramUser[]> | TelegramUser[];
  useSignatureNonce(nonce: string, address: Address, now?: number): Promise<boolean> | boolean;
  getLinkToken(token: string): Promise<LinkTokenRecord | null> | LinkTokenRecord | null;
  markLinkTokenUsed(token: string): Promise<void> | void;
  linkTelegramUser(chatId: string, address: Address, watchPercent?: number): Promise<void> | void;
  unlinkTelegramUser(address: Address): Promise<void> | void;
}

export type Clock = () => number;

export interface CoreConfig {
  factoryAddress: Address;
  troveManagerAddress: Address;
  priceFeedAddress: Address;
  sortedTrovesAddress: Address;
  deployBlockNumber: number;
  chunkSize: number;
  confirmationDepth: number;
  minProfitMargin: number;
  vaultCooldownMs: number;
  circuitBreakerMaxFailures: number;
  altruistic: boolean;
  dryRun: boolean;
  maxBlocksPerTick?: number;
  maxTickDurationMs?: number;
}

export interface TickResult {
  success: boolean;
  fromBlock: number;
  toBlock: number;
  newVaultsDiscovered: number;
  totalVaultsTracked: number;
  vaultsEvaluated: number;
  defensesAttempted: number;
  defensesSucceeded: number;
  defensesFailed: number;
  notificationsQueued: number;
  circuitBreakerTripped: boolean;
  pendingTxHash?: Hex;
  error?: string;
}
