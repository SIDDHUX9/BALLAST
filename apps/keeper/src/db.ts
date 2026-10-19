import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Address } from 'viem';
import type { TrackedVault, DefenseRecord, ICRSnapshot } from './types.js';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => DatabaseSyncType;
};

export class KeeperDatabase {
  private db: DatabaseSyncType;

  constructor(dbPath: string = 'ballast-keeper.db') {
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
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

  public close(): void {
    this.db.close();
  }
}
