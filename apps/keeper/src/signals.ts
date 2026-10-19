import { EventEmitter } from 'node:events';
import type { Address } from 'viem';
import type { KeeperDatabase } from './db.js';
import type { ICRSnapshot } from './types.js';

export interface EarlyWarningSignal {
  vault: Address;
  icr: bigint;
  icrPercent: number;
  blockNumber: number;
  timestamp: number;
  isNearTrigger?: boolean;
}

export class EarlyWarningService extends EventEmitter {
  private db: KeeperDatabase;
  private latestCache: Map<string, EarlyWarningSignal> = new Map();

  constructor(db: KeeperDatabase) {
    super();
    this.db = db;
  }

  public recordSnapshot(
    vault: Address,
    icr: bigint,
    blockNumber: number,
    triggerIcr?: bigint,
  ): void {
    const timestamp = Math.floor(Date.now() / 1000);
    const icrPercent = Number((icr * 10000n) / (10n ** 18n)) / 100;

    // Trigger warning if within 10% of trigger ICR
    let isNearTrigger = false;
    if (triggerIcr && triggerIcr > 0n) {
      const buffer = (triggerIcr * 110n) / 100n; // 10% safety buffer
      if (icr <= buffer) {
        isNearTrigger = true;
      }
    }

    const signal: EarlyWarningSignal = {
      vault,
      icr,
      icrPercent,
      blockNumber,
      timestamp,
      isNearTrigger,
    };

    // Cache latest
    this.latestCache.set(vault.toLowerCase(), signal);

    // Persist in DB
    const snapshot: ICRSnapshot = {
      vault,
      icr: icr.toString(),
      blockNumber,
      timestamp,
    };
    this.db.saveIcrSnapshot(snapshot);

    // Emit event for alerting subscribers
    this.emit('icr_snapshot', signal);

    if (isNearTrigger) {
      this.emit('warning_near_trigger', signal);
    }
  }

  public getLatestSignal(vault: Address): EarlyWarningSignal | undefined {
    return this.latestCache.get(vault.toLowerCase());
  }

  public getAllLatestSignals(): EarlyWarningSignal[] {
    return Array.from(this.latestCache.values());
  }

  public getHistory(vault: Address, limit: number = 50): ICRSnapshot[] {
    return this.db.getIcrHistory(vault, limit);
  }
}
