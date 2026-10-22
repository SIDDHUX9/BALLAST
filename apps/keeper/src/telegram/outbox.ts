import type { Logger } from 'pino';
import type { Bot } from 'grammy';
import type { KeeperDatabase } from '../db.js';

export interface OutboxSender {
  sendMessage(chatId: string, text: string): Promise<void>;
}

export class NotificationOutboxWorker {
  private db: KeeperDatabase;
  private sender: OutboxSender;
  private logger: Logger;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isProcessing: boolean = false;

  constructor(
    db: KeeperDatabase,
    sender: OutboxSender,
    logger: Logger,
    pollIntervalMs: number = 2000,
  ) {
    this.db = db;
    this.sender = sender;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Notification outbox worker started');

    this.timer = setInterval(async () => {
      if (this.isRunning && !this.isProcessing) {
        await this.processBatch();
      }
    }, this.pollIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info('Notification outbox worker stopped');
  }

  public async processBatch(): Promise<number> {
    this.isProcessing = true;
    let processedCount = 0;

    try {
      const items = this.db.getPendingNotifications(10);
      if (items.length === 0) return 0;

      for (const item of items) {
        // Check if user has muted alerts
        const userRows = this.db.getTelegramUserByChat(item.chatId);
        const isMuted = userRows.some((u) => u.mutedUntil > Date.now());

        if (isMuted) {
          this.logger.debug(
            { id: item.id, chatId: item.chatId },
            'Alert suppressed: user has active mute period',
          );
          this.db.markNotificationMuted(item.id);
          processedCount++;
          continue;
        }

        try {
          await this.sender.sendMessage(item.chatId, item.message);
          this.db.markNotificationSent(item.id);
          processedCount++;
          this.logger.info(
            { id: item.id, chatId: item.chatId, idempotencyKey: item.idempotencyKey },
            'Telegram notification successfully delivered',
          );
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const nextAttempt = item.attempts + 1;

          // Check for Telegram 429 retry_after
          let retryDelayMs = Math.min(60000, 1000 * Math.pow(2, nextAttempt)); // 2s, 4s, 8s, 16s...
          if (typeof err === 'object' && err !== null && 'parameters' in err) {
            const params = (err as { parameters?: { retry_after?: number } }).parameters;
            if (params?.retry_after) {
              retryDelayMs = params.retry_after * 1000;
            }
          }

          const nextRetryAt = Date.now() + retryDelayMs;
          this.db.recordNotificationFailure(item.id, nextAttempt, nextRetryAt, errorMessage);

          this.logger.warn(
            {
              id: item.id,
              chatId: item.chatId,
              attempts: nextAttempt,
              nextRetryAt,
              err: errorMessage,
            },
            'Failed to deliver Telegram notification; queued for backoff retry',
          );
        }
      }
    } catch (batchErr) {
      this.logger.error({ batchErr }, 'Error processing outbox batch');
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }
}
