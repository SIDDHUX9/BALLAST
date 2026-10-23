import type { Address } from "viem";
import type {
  StoreInterface,
  OutboxNotification,
} from "../apps/keeper/src/core/types.js";
import type {
  TrackedVault,
  DefenseRecord,
  ICRSnapshot,
} from "../apps/keeper/src/types.js";
import type {
  TelegramUser,
  LinkTokenRecord,
  AlertStateRecord,
} from "../apps/keeper/src/telegram/types.js";

export interface ConvexTickBatch {
  newVaults: TrackedVault[];
  newSnapshots: ICRSnapshot[];
  newDefenses: DefenseRecord[];
  alertStateUpdates: AlertStateRecord[];
  queuedNotifications: OutboxNotification[];
  cursorBlock: number;
}

/**
 * High-efficiency, zero-overhead in-memory StoreInterface adapter for Convex actions.
 * Pre-seeded with existing data from a single mutation call (acquireLeaseAndGetState),
 * collects all mutations produced during the tick, and commits them in a single batch mutation.
 * This guarantees strict free-plan arithmetic: exactly 2 Convex mutations per tick!
 */
export class ConvexTickStore implements StoreInterface {
  private cursor: number;
  private vaults: Map<string, TrackedVault>;
  private alertStates: Map<string, AlertStateRecord>;
  private telegramUsers: TelegramUser[];

  // Collected batch updates to be committed at tick completion
  public readonly newVaults: TrackedVault[] = [];
  public readonly newSnapshots: ICRSnapshot[] = [];
  public readonly newDefenses: DefenseRecord[] = [];
  public readonly alertStateUpdates: Map<string, AlertStateRecord> = new Map();
  public readonly queuedNotifications: OutboxNotification[] = [];

  constructor(options: {
    initialCursor: number;
    existingVaults: TrackedVault[];
    existingAlertStates: AlertStateRecord[];
    existingTelegramUsers: TelegramUser[];
  }) {
    this.cursor = options.initialCursor;
    this.vaults = new Map(
      options.existingVaults.map((v) => [v.address.toLowerCase(), v])
    );
    this.alertStates = new Map(
      options.existingAlertStates.map((a) => [a.id.toLowerCase(), a])
    );
    this.telegramUsers = options.existingTelegramUsers;
  }

  public getCursor(): number {
    return this.cursor;
  }

  public saveCursor(blockNumber: number): void {
    this.cursor = blockNumber;
  }

  public saveVault(vault: TrackedVault): void {
    const key = vault.address.toLowerCase();
    if (!this.vaults.has(key)) {
      this.vaults.set(key, vault);
      this.newVaults.push(vault);
    }
  }

  public getAllVaults(): TrackedVault[] {
    return Array.from(this.vaults.values());
  }

  public getVaultCount(): number {
    return this.vaults.size;
  }

  public saveDefense(record: DefenseRecord): void {
    this.newDefenses.push(record);
  }

  public getAlertState(vault: Address, alertType: string): AlertStateRecord | null {
    const key = `${vault.toLowerCase()}:${alertType}`.toLowerCase();
    return this.alertStates.get(key) ?? null;
  }

  public setAlertState(
    vault: Address,
    alertType: string,
    armed: boolean,
    lastVal: string | null = null,
    lastSentAt: number = Date.now()
  ): void {
    const id = `${vault.toLowerCase()}:${alertType}`;
    const record: AlertStateRecord = {
      id,
      vault,
      alertType,
      armed,
      lastValue: lastVal,
      lastSentAt,
    };
    this.alertStates.set(id.toLowerCase(), record);
    this.alertStateUpdates.set(id.toLowerCase(), record);
  }

  public queueNotification(notification: OutboxNotification): void {
    this.queuedNotifications.push(notification);
  }

  public saveIcrSnapshot(snapshot: ICRSnapshot): void {
    this.newSnapshots.push(snapshot);
  }

  public getTelegramUsersForAddress(address: Address): TelegramUser[] {
    const addr = address.toLowerCase();
    return this.telegramUsers.filter((u) => u.address.toLowerCase() === addr);
  }

  public getTelegramUsersForVault(vault: Address): TelegramUser[] {
    const v = this.vaults.get(vault.toLowerCase());
    if (!v) return [];
    return this.getTelegramUsersForAddress(v.owner);
  }

  public useSignatureNonce(): boolean {
    // Nonces are managed by Convex link mutations directly
    return true;
  }

  public getLinkToken(): LinkTokenRecord | null {
    return null;
  }

  public markLinkTokenUsed(): void {}

  public linkTelegramUser(): void {}

  public unlinkTelegramUser(): void {}

  public getBatch(): ConvexTickBatch {
    return {
      newVaults: this.newVaults,
      newSnapshots: this.newSnapshots,
      newDefenses: this.newDefenses,
      alertStateUpdates: Array.from(this.alertStateUpdates.values()),
      queuedNotifications: this.queuedNotifications,
      cursorBlock: this.cursor,
    };
  }
}
