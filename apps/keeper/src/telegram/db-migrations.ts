import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  name: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    name: '001_create_telegram_and_alert_tables',
    up: (db: DatabaseSync) => {
      db.exec(`
        -- Telegram registered users binding wallet address and chat ID
        CREATE TABLE IF NOT EXISTS telegram_users (
          chat_id TEXT NOT NULL,
          address TEXT NOT NULL,
          watch_percent REAL,
          muted_until INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          PRIMARY KEY (chat_id, address)
        );

        CREATE INDEX IF NOT EXISTS idx_telegram_users_address ON telegram_users(address);
        CREATE INDEX IF NOT EXISTS idx_telegram_users_chat ON telegram_users(chat_id);

        -- Ephemeral link tokens for deep link auth
        CREATE TABLE IF NOT EXISTS link_tokens (
          token TEXT PRIMARY KEY,
          chat_id TEXT,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_link_tokens_expires ON link_tokens(expires_at);

        -- Replay protection for wallet signatures
        CREATE TABLE IF NOT EXISTS signature_nonces (
          nonce TEXT NOT NULL,
          address TEXT NOT NULL,
          used_at INTEGER NOT NULL,
          PRIMARY KEY (nonce, address)
        );

        -- Alert hysteresis state tracking per vault and alert type
        CREATE TABLE IF NOT EXISTS alert_states (
          id TEXT PRIMARY KEY,
          vault TEXT NOT NULL,
          alert_type TEXT NOT NULL,
          armed INTEGER NOT NULL DEFAULT 1,
          last_val TEXT,
          last_sent_at INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_alert_states_vault ON alert_states(vault);

        -- Notification outbox with retries, exponential backoff, and idempotency
        CREATE TABLE IF NOT EXISTS notification_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          idempotency_key TEXT UNIQUE NOT NULL,
          chat_id TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 5,
          next_retry_at INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          sent_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_pending ON notification_outbox(status, next_retry_at);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): void {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    const checkStmt = db.prepare(`SELECT 1 FROM schema_migrations WHERE name = ?`);
    const applied = checkStmt.get(migration.name);

    if (!applied) {
      migration.up(db);
      const insertStmt = db.prepare(
        `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`
      );
      insertStmt.run(migration.name, new Date().toISOString());
    }
  }
}
