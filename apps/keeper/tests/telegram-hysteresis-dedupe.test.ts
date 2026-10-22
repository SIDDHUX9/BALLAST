import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import type { Address } from 'viem';
import { KeeperDatabase } from '../src/db.js';
import { AlertManager } from '../src/telegram/alerts.js';
import { NotificationOutboxWorker, type OutboxSender } from '../src/telegram/outbox.js';
import { PRECISION } from '@ballast/shared';

describe('Telegram Alerts: Hysteresis, Deduplication, and Outbox', () => {
  let db: KeeperDatabase;
  let alertManager: AlertManager;
  const logger = pino({ level: 'silent' });
  const vault = '0x1111111111111111111111111111111111111111' as Address;
  const owner = '0x2222222222222222222222222222222222222222' as Address;
  const chatId = '99887766';

  beforeEach(() => {
    db = new KeeperDatabase(':memory:');
    alertManager = new AlertManager(db, 15.0);

    // Save vault and link user
    db.saveVault({
      address: vault,
      owner,
      createdBlock: 100,
      txHash: '0xabc',
      discoveredAt: new Date().toISOString(),
    });

    db.linkTelegramUser(chatId, owner, 140.0);
  });

  describe('Warning Alert Hysteresis', () => {
    it('fires warning when ICR drops below watch level and disarms', () => {
      // Watch level: 140%, Trigger: 130%
      // Initial ICR: 138% (below 140%)
      const fired1 = alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (138n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      expect(fired1).toBe(true);

      const state1 = db.getAlertState(vault, 'warning');
      expect(state1?.armed).toBe(false);

      // Notification must be queued in outbox
      const pending = db.getPendingNotifications();
      expect(pending.length).toBe(1);
      expect(pending[0].chatId).toBe(chatId);
      expect(pending[0].message).toContain('WARNING: ICR below watch level');
      expect(pending[0].message).toContain('Current ICR: 138.0%');
    });

    it('does NOT fire duplicate alert while ICR remains below watch level', () => {
      // First drop to 138% -> fires and disarms
      alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (138n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      // Subsequent drop to 135% -> should NOT fire another warning
      const fired2 = alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (135n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      expect(fired2).toBe(false);
      expect(db.getPendingNotifications().length).toBe(1);
    });

    it('does NOT re-arm when ICR recovers only partially (< watchLevel + 2%)', () => {
      // Drop to 138%
      alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (138n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      // Recovers to 141% (which is > 140% watchLevel, but < 142% required for re-arm)
      const firedPartial = alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (141n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      expect(firedPartial).toBe(false);
      const state = db.getAlertState(vault, 'warning');
      expect(state?.armed).toBe(false); // Still disarmed!
    });

    it('re-arms when ICR recovers >= watchLevel + 2%, then fires again on next drop', () => {
      // 1. Initial drop to 138%
      alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (138n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      // 2. Recovers to 142.5% (>= 140 + 2 = 142)
      alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (1425n * PRECISION) / 1000n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      const stateRearmed = db.getAlertState(vault, 'warning');
      expect(stateRearmed?.armed).toBe(true);

      // 3. Drops again to 137% -> Must fire second alert!
      // Clear outbox to verify new message arrives
      const pendingBefore = db.getPendingNotifications();
      db.markNotificationSent(pendingBefore[0].id);

      const firedAgain = alertManager.evaluateWarningAlert({
        vault,
        currentIcr: (137n * PRECISION) / 100n,
        watchLevelPercent: 140.0,
        triggerIcrPercent: 130.0,
        liquidationPrice: 50000n * PRECISION,
      });

      expect(firedAgain).toBe(true);
      const pendingAfter = db.getPendingNotifications();
      expect(pendingAfter.length).toBe(1);
      expect(pendingAfter[0].message).toContain('Current ICR: 137.0%');
    });
  });

  describe('Reserve Low Alert Hysteresis', () => {
    it('fires reserve low when absorbable drop is below 15% and disarms', () => {
      const fired = alertManager.evaluateReserveLowAlert({
        vault,
        currentIcr: (145n * PRECISION) / 100n,
        absorbableDropPercent: 12.5, // < 15%
        musdReserve: 100n * PRECISION,
        btcReserve: 0n,
      });

      expect(fired).toBe(true);
      const state = db.getAlertState(vault, 'reserve_low');
      expect(state?.armed).toBe(false);

      const pending = db.getPendingNotifications();
      expect(pending.length).toBe(1);
      expect(pending[0].message).toContain('RESERVE LOW');
      expect(pending[0].message).toContain('a further 12.5% BTC drop can be absorbed');
    });

    it('re-arms reserve low only after capacity recovers above threshold + 5%', () => {
      // Disarm at 12%
      alertManager.evaluateReserveLowAlert({
        vault,
        currentIcr: (145n * PRECISION) / 100n,
        absorbableDropPercent: 12.0,
        musdReserve: 100n * PRECISION,
        btcReserve: 0n,
      });

      // Partial recovery to 18% (< 20%) -> still disarmed
      alertManager.evaluateReserveLowAlert({
        vault,
        currentIcr: (145n * PRECISION) / 100n,
        absorbableDropPercent: 18.0,
        musdReserve: 200n * PRECISION,
        btcReserve: 0n,
      });
      expect(db.getAlertState(vault, 'reserve_low')?.armed).toBe(false);

      // Full recovery to 22% (>= 20%) -> re-arms!
      alertManager.evaluateReserveLowAlert({
        vault,
        currentIcr: (145n * PRECISION) / 100n,
        absorbableDropPercent: 22.0,
        musdReserve: 500n * PRECISION,
        btcReserve: 0n,
      });
      expect(db.getAlertState(vault, 'reserve_low')?.armed).toBe(true);
    });
  });

  describe('Outbox Deduplication & Exponential Backoff', () => {
    it('rejects duplicate idempotency keys to prevent double-sending', () => {
      const key = 'test-idempotency-key-1';
      const inserted1 = db.enqueueNotification(key, chatId, 'Message 1');
      const inserted2 = db.enqueueNotification(key, chatId, 'Message 1 duplicate');

      expect(inserted1).toBe(true);
      expect(inserted2).toBe(false);

      const pending = db.getPendingNotifications();
      expect(pending.length).toBe(1);
      expect(pending[0].message).toBe('Message 1');
    });

    it('applies exponential backoff on delivery failure', async () => {
      db.enqueueNotification('retry-key-1', chatId, 'Retry message');

      const mockSender: OutboxSender = {
        sendMessage: async () => {
          throw new Error('Telegram network error');
        },
      };

      const worker = new NotificationOutboxWorker(db, mockSender, logger);

      // Attempt 1: fails
      const processed1 = await worker.processBatch();
      expect(processed1).toBe(0);

      const row = db.getPendingNotifications(100).length; // next_retry_at is in future, so getPendingNotifications() returns 0!
      expect(row).toBe(0);

      // Query raw row to inspect attempt count
      const stmt = (db as any).db.prepare(`SELECT attempts, next_retry_at, status FROM notification_outbox WHERE idempotency_key = 'retry-key-1'`);
      const record = stmt.get() as { attempts: number; next_retry_at: number; status: string };

      expect(record.attempts).toBe(1);
      expect(record.status).toBe('pending');
      expect(record.next_retry_at).toBeGreaterThan(Date.now());
    });

    it('suppresses notifications when user has an active mute period', async () => {
      // Mute user for 2 hours
      db.setMute(chatId, Date.now() + 2 * 3600 * 1000);

      db.enqueueNotification('mute-test-key', chatId, 'Muted alert message');

      let sent = false;
      const mockSender: OutboxSender = {
        sendMessage: async () => {
          sent = true;
        },
      };

      const worker = new NotificationOutboxWorker(db, mockSender, logger);
      const processed = await worker.processBatch();

      expect(processed).toBe(1);
      expect(sent).toBe(false); // sender was never called

      const stmt = (db as any).db.prepare(`SELECT status FROM notification_outbox WHERE idempotency_key = 'mute-test-key'`);
      const record = stmt.get() as { status: string };
      expect(record.status).toBe('muted');
    });
  });
});
