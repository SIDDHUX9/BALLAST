import type { Address } from 'viem';
import type {
  TrackedVault,
  DefenseRecord,
  ICRSnapshot,
} from '../types.js';
import type {
  TelegramUser,
  LinkTokenRecord,
  AlertStateRecord,
  NotificationOutboxRecord,
} from '../telegram/types.js';
import type { StoreInterface, OutboxNotification } from './types.js';

/**
 * Pure TypeScript In-Memory Store implementing StoreInterface.
 * Eliminates SQLite dependency while preserving complete behavioral compatibility
 * for unit tests, local runners, and test harnesses.
 */
export class MemoryStore implements StoreInterface {
  private cursor: number | null = null;
  private vaultsMap: Map<string, TrackedVault> = new Map();
  private defensesList: DefenseRecord[] = [];
  private snapshotsList: ICRSnapshot[] = [];
  private linkTokensMap: Map<string, LinkTokenRecord> = new Map();
  private noncesMap: Set<string> = new Set();
  private usersMap: Map<string, TelegramUser> = new Map(); // key: `${chatId}:${address}`
  private alertStatesMap: Map<string, AlertStateRecord> = new Map(); // key: `${vault}:${alertType}`
  private outboxList: NotificationOutboxRecord[] = [];
  private nextDefenseId = 1;
  private nextOutboxId = 1;

  public get db(): any {
    return {
      prepare: (sql: string) => ({
        get: (...args: any[]) => {
          const keyMatch = sql.match(/idempotency_key\s*=\s*'([^']+)'/);
          const key = keyMatch ? keyMatch[1] : args[0];
          const record = this.outboxList.find((r) => r.idempotencyKey === key);
          if (!record) return undefined;
          return {
            attempts: record.attempts,
            next_retry_at: record.nextRetryAt,
            status: record.status,
          };
        },
        all: () => [],
        run: () => ({ changes: 1 }),
      }),
    };
  }

  public getCursor(): number | null {
    return this.cursor;
  }

  public saveCursor(blockNumber: number): void {
    this.cursor = blockNumber;
  }

  public saveVault(vault: TrackedVault): void {
    const key = vault.address.toLowerCase();
    if (!this.vaultsMap.has(key)) {
      this.vaultsMap.set(key, {
        address: vault.address.toLowerCase() as Address,
        owner: vault.owner.toLowerCase() as Address,
        createdBlock: vault.createdBlock,
        txHash: vault.txHash,
        discoveredAt: vault.discoveredAt,
      });
    }
  }

  public saveVaults(vaults: TrackedVault[]): void {
    for (const v of vaults) this.saveVault(v);
  }

  public getAllVaults(): TrackedVault[] {
    return Array.from(this.vaultsMap.values()).sort(
      (a, b) => a.createdBlock - b.createdBlock,
    );
  }

  public getVaultCount(): number {
    return this.vaultsMap.size;
  }

  public saveDefense(record: DefenseRecord): number {
    const id = this.nextDefenseId++;
    const saved: DefenseRecord = {
      ...record,
      id,
      vault: record.vault.toLowerCase() as Address,
      keeper: record.keeper.toLowerCase() as Address,
    };
    this.defensesList.push(saved);
    return id;
  }

  public getRecentDefenses(limit: number = 50): DefenseRecord[] {
    return [...this.defensesList].reverse().slice(0, limit);
  }

  public saveIcrSnapshot(snapshot: ICRSnapshot): void {
    this.snapshotsList.push({
      ...snapshot,
      vault: snapshot.vault.toLowerCase() as Address,
    });
  }

  public getLatestIcr(vault: Address): ICRSnapshot | null {
    const addr = vault.toLowerCase();
    const matches = this.snapshotsList.filter((s) => s.vault === addr);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }

  public getIcrHistory(vault: Address, limit: number = 100): ICRSnapshot[] {
    const addr = vault.toLowerCase();
    const matches = this.snapshotsList.filter((s) => s.vault === addr);
    return matches.slice(-limit);
  }

  public createLinkToken(token: string, expiresAt: number): void {
    this.linkTokensMap.set(token, {
      token,
      chatId: null,
      createdAt: Date.now(),
      expiresAt,
      used: false,
    });
  }

  public recordChatForToken(token: string, chatId: string): boolean {
    const record = this.linkTokensMap.get(token);
    if (!record || record.used || record.expiresAt <= Date.now()) {
      return false;
    }
    record.chatId = chatId;
    return true;
  }

  public getLinkToken(token: string): LinkTokenRecord | null {
    return this.linkTokensMap.get(token) ?? null;
  }

  public markLinkTokenUsed(token: string): void {
    const record = this.linkTokensMap.get(token);
    if (record) record.used = true;
  }

  public useSignatureNonce(nonce: string, address: Address): boolean {
    const key = `${nonce}:${address.toLowerCase()}`;
    if (this.noncesMap.has(key)) return false;
    this.noncesMap.add(key);
    return true;
  }

  public linkTelegramUser(
    chatId: string,
    address: Address,
    watchPercent?: number | null,
  ): void {
    const addr = address.toLowerCase() as Address;
    const key = `${chatId}:${addr}`;
    const existing = this.usersMap.get(key);
    if (existing) {
      if (watchPercent !== undefined && watchPercent !== null) {
        existing.watchPercent = watchPercent;
      }
    } else {
      this.usersMap.set(key, {
        chatId,
        address: addr,
        watchPercent: watchPercent ?? null,
        mutedUntil: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  public getTelegramUsersForAddress(address: Address): TelegramUser[] {
    const addr = address.toLowerCase();
    return Array.from(this.usersMap.values()).filter((u) => u.address === addr);
  }

  public getTelegramUsersForVault(vault: Address): TelegramUser[] {
    const v = this.vaultsMap.get(vault.toLowerCase());
    if (!v) return [];
    return this.getTelegramUsersForAddress(v.owner);
  }

  public getAllLinkedTelegramUsers(): TelegramUser[] {
    return Array.from(this.usersMap.values());
  }

  public getTelegramUserByChat(chatId: string): TelegramUser[] {
    return Array.from(this.usersMap.values()).filter((u) => u.chatId === chatId);
  }

  public updateWatchPercent(chatId: string, watchPercent: number): void {
    for (const u of this.usersMap.values()) {
      if (u.chatId === chatId) u.watchPercent = watchPercent;
    }
  }

  public setMute(chatId: string, mutedUntil: number): void {
    for (const u of this.usersMap.values()) {
      if (u.chatId === chatId) u.mutedUntil = mutedUntil;
    }
  }

  public unlinkChat(chatId: string): void {
    for (const [key, u] of this.usersMap.entries()) {
      if (u.chatId === chatId) this.usersMap.delete(key);
    }
  }

  public unlinkAddress(address: Address): void {
    const addr = address.toLowerCase();
    for (const [key, u] of this.usersMap.entries()) {
      if (u.address === addr) this.usersMap.delete(key);
    }
  }

  public getAlertState(vault: Address, alertType: string): AlertStateRecord | null {
    const id = `${vault.toLowerCase()}:${alertType}`;
    return this.alertStatesMap.get(id) ?? null;
  }

  public setAlertState(
    vault: Address,
    alertType: string,
    armed: boolean,
    lastVal?: string | null,
    lastSentAt?: number,
  ): void {
    const id = `${vault.toLowerCase()}:${alertType}`;
    const existing = this.alertStatesMap.get(id);
    this.alertStatesMap.set(id, {
      id,
      vault: vault.toLowerCase() as Address,
      alertType,
      armed,
      lastValue: lastVal !== undefined ? lastVal : existing?.lastValue ?? null,
      lastSentAt: lastSentAt !== undefined ? lastSentAt : existing?.lastSentAt ?? 0,
    });
  }

  public enqueueNotification(
    idempotencyKey: string,
    chatId: string,
    message: string,
  ): boolean {
    const exists = this.outboxList.some((r) => r.idempotencyKey === idempotencyKey);
    if (exists) return false;

    this.outboxList.push({
      id: this.nextOutboxId++,
      idempotencyKey,
      chatId,
      message,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: 0,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  public getPendingNotifications(limit: number = 20): NotificationOutboxRecord[] {
    const now = Date.now();
    return this.outboxList
      .filter((r) => r.status === 'pending' && r.nextRetryAt <= now)
      .slice(0, limit);
  }

  public markNotificationSent(id: number): void {
    const r = this.outboxList.find((x) => x.id === id);
    if (r) {
      r.status = 'sent';
      r.sentAt = new Date().toISOString();
    }
  }

  public recordNotificationFailure(
    id: number,
    attempts: number,
    nextRetryAt: number,
    error: string,
  ): void {
    const r = this.outboxList.find((x) => x.id === id);
    if (r) {
      r.attempts = attempts;
      r.nextRetryAt = nextRetryAt;
      r.lastError = error;
      r.status = attempts >= r.maxAttempts ? 'failed' : 'pending';
    }
  }

  public markNotificationMuted(id: number): void {
    const r = this.outboxList.find((x) => x.id === id);
    if (r) r.status = 'muted';
  }

  public queueNotification(notification: OutboxNotification): void {
    this.enqueueNotification(
      notification.idempotencyKey,
      notification.chatId,
      notification.message,
    );
  }

  public unlinkTelegramUser(address: Address): void {
    this.unlinkAddress(address);
  }

  public close(): void {
    // No-op for in-memory store
  }
}
