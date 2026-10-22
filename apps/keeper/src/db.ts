import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Address } from 'viem';
import type { TrackedVault, DefenseRecord, ICRSnapshot } from './types.js';
import { runMigrations } from './telegram/db-migrations.js';
import type {
  TelegramUser,
  LinkTokenRecord,
  AlertStateRecord,
  NotificationOutboxRecord,
} from './telegram/types.js';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => DatabaseSyncType;
};

export class KeeperDatabase {
  private db: DatabaseSyncType;

  constructor(dbPath: string = 'ballast-keeper.db') {
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
    runMigrations(this.db);
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_cursor (
        id TEXT PRIMARY KEY,
        last_block_number INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vaults (
        address TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        created_block INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        discovered_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vaults_block ON vaults(created_block);

      CREATE TABLE IF NOT EXISTS defenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vault TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        keeper TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        musd_repaid TEXT NOT NULL,
        btc_added TEXT NOT NULL,
        musd_tip TEXT NOT NULL,
        btc_tip TEXT NOT NULL,
        old_icr TEXT NOT NULL,
        new_icr TEXT NOT NULL,
        gas_used TEXT,
        effective_gas_price TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_defenses_vault ON defenses(vault);
      CREATE INDEX IF NOT EXISTS idx_defenses_status ON defenses(status);

      CREATE TABLE IF NOT EXISTS icr_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vault TEXT NOT NULL,
        icr TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_icr_vault_time ON icr_snapshots(vault, timestamp);
    `);
  }

  public getCursor(): number | null {
    const stmt = this.db.prepare(
      `SELECT last_block_number FROM sync_cursor WHERE id = 'discovery_cursor'`,
    );
    const row = stmt.get() as { last_block_number: number } | undefined;
    return row ? Number(row.last_block_number) : null;
  }

  public saveCursor(blockNumber: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_cursor (id, last_block_number, updated_at)
      VALUES ('discovery_cursor', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_block_number = excluded.last_block_number,
        updated_at = excluded.updated_at
    `);
    stmt.run(blockNumber, new Date().toISOString());
  }

  public saveVault(vault: TrackedVault): void {
    const stmt = this.db.prepare(`
      INSERT INTO vaults (address, owner, created_block, tx_hash, discovered_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(address) DO NOTHING
    `);
    stmt.run(
      vault.address.toLowerCase(),
      vault.owner.toLowerCase(),
      vault.createdBlock,
      vault.txHash,
      vault.discoveredAt,
    );
  }

  public saveVaults(vaults: TrackedVault[]): void {
    for (const vault of vaults) {
      this.saveVault(vault);
    }
  }

  public getAllVaults(): TrackedVault[] {
    const stmt = this.db.prepare(`
      SELECT address, owner, created_block, tx_hash, discovered_at
      FROM vaults
      ORDER BY created_block ASC
    `);
    const rows = stmt.all() as Array<{
      address: string;
      owner: string;
      created_block: number;
      tx_hash: string;
      discovered_at: string;
    }>;

    return rows.map((r) => ({
      address: r.address as Address,
      owner: r.owner as Address,
      createdBlock: Number(r.created_block),
      txHash: r.tx_hash,
      discoveredAt: r.discovered_at,
    }));
  }

  public getVaultCount(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM vaults`);
    const row = stmt.get() as { count: number };
    return Number(row.count);
  }

  public saveDefense(record: DefenseRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO defenses (
        vault, tx_hash, keeper, block_number,
        musd_repaid, btc_added, musd_tip, btc_tip,
        old_icr, new_icr, gas_used, effective_gas_price,
        status, created_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      record.vault.toLowerCase(),
      record.txHash,
      record.keeper.toLowerCase(),
      record.blockNumber,
      record.musdRepaid,
      record.btcAdded,
      record.musdTip,
      record.btcTip,
      record.oldIcr,
      record.newIcr,
      record.gasUsed ?? null,
      record.effectiveGasPrice ?? null,
      record.status,
      record.createdAt,
      record.error ?? null,
    );

    return Number(result.lastInsertRowid);
  }

  public getRecentDefenses(limit: number = 50): DefenseRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM defenses
      ORDER BY id DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as Array<{
      id: number;
      vault: string;
      tx_hash: string;
      keeper: string;
      block_number: number;
      musd_repaid: string;
      btc_added: string;
      musd_tip: string;
      btc_tip: string;
      old_icr: string;
      new_icr: string;
      gas_used: string | null;
      effective_gas_price: string | null;
      status: 'simulated' | 'submitted' | 'confirmed' | 'failed';
      created_at: string;
      error: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      vault: r.vault as Address,
      txHash: r.tx_hash,
      keeper: r.keeper as Address,
      blockNumber: Number(r.block_number),
      musdRepaid: r.musd_repaid,
      btcAdded: r.btc_added,
      musdTip: r.musd_tip,
      btcTip: r.btc_tip,
      oldIcr: r.old_icr,
      newIcr: r.new_icr,
      gasUsed: r.gas_used ?? undefined,
      effectiveGasPrice: r.effective_gas_price ?? undefined,
      status: r.status,
      createdAt: r.created_at,
      error: r.error ?? undefined,
    }));
  }

  public saveIcrSnapshot(snapshot: ICRSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT INTO icr_snapshots (vault, icr, block_number, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      snapshot.vault.toLowerCase(),
      snapshot.icr,
      snapshot.blockNumber,
      snapshot.timestamp,
    );
  }

  public getLatestIcr(vault: Address): ICRSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT vault, icr, block_number, timestamp
      FROM icr_snapshots
      WHERE vault = ?
      ORDER BY id DESC
      LIMIT 1
    `);
    const row = stmt.get(vault.toLowerCase()) as {
      vault: string;
      icr: string;
      block_number: number;
      timestamp: number;
    } | undefined;

    if (!row) return null;
    return {
      vault: row.vault as Address,
      icr: row.icr,
      blockNumber: Number(row.block_number),
      timestamp: Number(row.timestamp),
    };
  }

  public getIcrHistory(vault: Address, limit: number = 100): ICRSnapshot[] {
    const stmt = this.db.prepare(`
      SELECT vault, icr, block_number, timestamp
      FROM icr_snapshots
      WHERE vault = ?
      ORDER BY id DESC
      LIMIT ?
    `);
    const rows = stmt.all(vault.toLowerCase(), limit) as Array<{
      vault: string;
      icr: string;
      block_number: number;
      timestamp: number;
    }>;

    return rows.reverse().map((r) => ({
      vault: r.vault as Address,
      icr: r.icr,
      blockNumber: Number(r.block_number),
      timestamp: Number(r.timestamp),
    }));
  }

  // ----------------------------------------------------
  // Telegram Users & Link Tokens
  // ----------------------------------------------------

  public createLinkToken(token: string, expiresAt: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO link_tokens (token, chat_id, created_at, expires_at, used)
      VALUES (?, NULL, ?, ?, 0)
    `);
    stmt.run(token, Date.now(), expiresAt);
  }

  public recordChatForToken(token: string, chatId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE link_tokens
      SET chat_id = ?
      WHERE token = ? AND used = 0 AND expires_at > ?
    `);
    const result = stmt.run(chatId, token, Date.now());
    return result.changes > 0;
  }

  public getLinkToken(token: string): LinkTokenRecord | null {
    const stmt = this.db.prepare(`
      SELECT token, chat_id, created_at, expires_at, used
      FROM link_tokens
      WHERE token = ?
    `);
    const row = stmt.get(token) as {
      token: string;
      chat_id: string | null;
      created_at: number;
      expires_at: number;
      used: number;
    } | undefined;

    if (!row) return null;
    return {
      token: row.token,
      chatId: row.chat_id,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
      used: row.used === 1,
    };
  }

  public markLinkTokenUsed(token: string): void {
    const stmt = this.db.prepare(`
      UPDATE link_tokens
      SET used = 1
      WHERE token = ?
    `);
    stmt.run(token);
  }

  public useSignatureNonce(nonce: string, address: Address): boolean {
    const checkStmt = this.db.prepare(`
      SELECT 1 FROM signature_nonces WHERE nonce = ? AND address = ?
    `);
    const existing = checkStmt.get(nonce, address.toLowerCase());
    if (existing) return false;

    const stmt = this.db.prepare(`
      INSERT INTO signature_nonces (nonce, address, used_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(nonce, address.toLowerCase(), Date.now());
    return true;
  }

  public linkTelegramUser(
    chatId: string,
    address: Address,
    watchPercent?: number | null,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO telegram_users (chat_id, address, watch_percent, muted_until, created_at)
      VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(chat_id, address) DO UPDATE SET
        watch_percent = COALESCE(excluded.watch_percent, telegram_users.watch_percent)
    `);
    stmt.run(
      chatId,
      address.toLowerCase(),
      watchPercent ?? null,
      new Date().toISOString(),
    );
  }

  public getTelegramUsersForAddress(address: Address): TelegramUser[] {
    const stmt = this.db.prepare(`
      SELECT chat_id, address, watch_percent, muted_until, created_at
      FROM telegram_users
      WHERE address = ?
    `);
    const rows = stmt.all(address.toLowerCase()) as Array<{
      chat_id: string;
      address: string;
      watch_percent: number | null;
      muted_until: number;
      created_at: string;
    }>;

    return rows.map((r) => ({
      chatId: r.chat_id,
      address: r.address as Address,
      watchPercent: r.watch_percent !== null ? Number(r.watch_percent) : null,
      mutedUntil: Number(r.muted_until),
      createdAt: r.created_at,
    }));
  }

  public getTelegramUsersForVault(vault: Address): TelegramUser[] {
    const stmt = this.db.prepare(`
      SELECT u.chat_id, u.address, u.watch_percent, u.muted_until, u.created_at
      FROM telegram_users u
      JOIN vaults v ON LOWER(v.owner) = LOWER(u.address)
      WHERE LOWER(v.address) = LOWER(?)
    `);
    const rows = stmt.all(vault.toLowerCase()) as Array<{
      chat_id: string;
      address: string;
      watch_percent: number | null;
      muted_until: number;
      created_at: string;
    }>;

    return rows.map((r) => ({
      chatId: r.chat_id,
      address: r.address as Address,
      watchPercent: r.watch_percent !== null ? Number(r.watch_percent) : null,
      mutedUntil: Number(r.muted_until),
      createdAt: r.created_at,
    }));
  }

  public getAllLinkedTelegramUsers(): TelegramUser[] {
    const stmt = this.db.prepare(`
      SELECT chat_id, address, watch_percent, muted_until, created_at
      FROM telegram_users
    `);
    const rows = stmt.all() as Array<{
      chat_id: string;
      address: string;
      watch_percent: number | null;
      muted_until: number;
      created_at: string;
    }>;

    return rows.map((r) => ({
      chatId: r.chat_id,
      address: r.address as Address,
      watchPercent: r.watch_percent !== null ? Number(r.watch_percent) : null,
      mutedUntil: Number(r.muted_until),
      createdAt: r.created_at,
    }));
  }

  public getTelegramUserByChat(chatId: string): TelegramUser[] {
    const stmt = this.db.prepare(`
      SELECT chat_id, address, watch_percent, muted_until, created_at
      FROM telegram_users
      WHERE chat_id = ?
    `);
    const rows = stmt.all(chatId) as Array<{
      chat_id: string;
      address: string;
      watch_percent: number | null;
      muted_until: number;
      created_at: string;
    }>;

    return rows.map((r) => ({
      chatId: r.chat_id,
      address: r.address as Address,
      watchPercent: r.watch_percent !== null ? Number(r.watch_percent) : null,
      mutedUntil: Number(r.muted_until),
      createdAt: r.created_at,
    }));
  }

  public updateWatchPercent(chatId: string, watchPercent: number): void {
    const stmt = this.db.prepare(`
      UPDATE telegram_users
      SET watch_percent = ?
      WHERE chat_id = ?
    `);
    stmt.run(watchPercent, chatId);
  }

  public setMute(chatId: string, mutedUntil: number): void {
    const stmt = this.db.prepare(`
      UPDATE telegram_users
      SET muted_until = ?
      WHERE chat_id = ?
    `);
    stmt.run(mutedUntil, chatId);
  }

  public unlinkChat(chatId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM telegram_users
      WHERE chat_id = ?
    `);
    stmt.run(chatId);
  }

  public unlinkAddress(address: Address): void {
    const stmt = this.db.prepare(`
      DELETE FROM telegram_users
      WHERE address = ?
    `);
    stmt.run(address.toLowerCase());
  }

  // ----------------------------------------------------
  // Alert Hysteresis State
  // ----------------------------------------------------

  public getAlertState(vault: Address, alertType: string): AlertStateRecord | null {
    const id = `${vault.toLowerCase()}:${alertType}`;
    const stmt = this.db.prepare(`
      SELECT id, vault, alert_type, armed, last_val, last_sent_at
      FROM alert_states
      WHERE id = ?
    `);
    const row = stmt.get(id) as {
      id: string;
      vault: string;
      alert_type: string;
      armed: number;
      last_val: string | null;
      last_sent_at: number;
    } | undefined;

    if (!row) return null;
    return {
      id: row.id,
      vault: row.vault as Address,
      alertType: row.alert_type,
      armed: row.armed === 1,
      lastValue: row.last_val,
      lastSentAt: Number(row.last_sent_at),
    };
  }

  public setAlertState(
    vault: Address,
    alertType: string,
    armed: boolean,
    lastVal?: string | null,
    lastSentAt?: number,
  ): void {
    const id = `${vault.toLowerCase()}:${alertType}`;
    const stmt = this.db.prepare(`
      INSERT INTO alert_states (id, vault, alert_type, armed, last_val, last_sent_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        armed = excluded.armed,
        last_val = COALESCE(excluded.last_val, alert_states.last_val),
        last_sent_at = COALESCE(excluded.last_sent_at, alert_states.last_sent_at)
    `);
    stmt.run(
      id,
      vault.toLowerCase(),
      alertType,
      armed ? 1 : 0,
      lastVal ?? null,
      lastSentAt ?? null,
    );
  }

  // ----------------------------------------------------
  // Notification Outbox
  // ----------------------------------------------------

  public enqueueNotification(
    idempotencyKey: string,
    chatId: string,
    message: string,
  ): boolean {
    const stmt = this.db.prepare(`
      INSERT INTO notification_outbox (
        idempotency_key, chat_id, message, status, attempts, max_attempts, next_retry_at, created_at
      ) VALUES (?, ?, ?, 'pending', 0, 5, 0, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `);
    const result = stmt.run(idempotencyKey, chatId, message, new Date().toISOString());
    return result.changes > 0;
  }

  public getPendingNotifications(limit: number = 20): NotificationOutboxRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, idempotency_key, chat_id, message, status, attempts, max_attempts, next_retry_at, last_error, created_at, sent_at
      FROM notification_outbox
      WHERE status = 'pending' AND next_retry_at <= ?
      ORDER BY id ASC
      LIMIT ?
    `);
    const rows = stmt.all(Date.now(), limit) as Array<{
      id: number;
      idempotency_key: string;
      chat_id: string;
      message: string;
      status: string;
      attempts: number;
      max_attempts: number;
      next_retry_at: number;
      last_error: string | null;
      created_at: string;
      sent_at: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      idempotencyKey: r.idempotency_key,
      chatId: r.chat_id,
      message: r.message,
      status: r.status as NotificationOutboxRecord['status'],
      attempts: Number(r.attempts),
      maxAttempts: Number(r.max_attempts),
      nextRetryAt: Number(r.next_retry_at),
      lastError: r.last_error ?? undefined,
      createdAt: r.created_at,
      sentAt: r.sent_at ?? undefined,
    }));
  }

  public markNotificationSent(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE notification_outbox
      SET status = 'sent', sent_at = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  public recordNotificationFailure(
    id: number,
    attempts: number,
    nextRetryAt: number,
    error: string,
  ): void {
    const stmt = this.db.prepare(`
      UPDATE notification_outbox
      SET attempts = ?, next_retry_at = ?, last_error = ?,
          status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END
      WHERE id = ?
    `);
    stmt.run(attempts, nextRetryAt, error, id);
  }

  public markNotificationMuted(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE notification_outbox
      SET status = 'muted'
      WHERE id = ?
    `);
    stmt.run(id);
  }

  public close(): void {
    this.db.close();
  }
}
