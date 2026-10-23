import { MemoryStore } from './core/memory-store.js';
import type { DatabaseSync } from 'node:sqlite';

/**
 * KeeperDatabase compatibility layer wrapping MemoryStore.
 * Eliminates native SQLite C++ bindings and disk file locks.
 */
export class KeeperDatabase extends MemoryStore {
  constructor(_dbPath?: string) {
    super();
  }
}
