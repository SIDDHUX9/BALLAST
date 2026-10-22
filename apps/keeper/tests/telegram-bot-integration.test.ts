import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import type { Address } from 'viem';
import { KeeperDatabase } from '../src/db.js';
import { TelegramBotService } from '../src/telegram/bot.js';
import { NotificationOutboxWorker } from '../src/telegram/outbox.js';
import { PRECISION } from '@ballast/shared';

describe('Telegram Bot Commands & Outbox Integration', () => {
  let db: KeeperDatabase;
  let botService: TelegramBotService;
  const logger = pino({ level: 'silent' });
  const sentMessages: Array<{ chatId: string; text: string }> = [];

  const factoryAddress = '0x8d5b392839300b487addeecc35f5bc534111cd33' as Address;
  const vaultAddress = '0xa506b2250b85a0c7de80dd313a0db9cd8a655d5a' as Address;
  const ownerAddress = '0xb6ba1be32b7ca2729551882b71e8f469d06510e6' as Address;
  const chatId = 123456789;

  beforeEach(() => {
    db = new KeeperDatabase(':memory:');
    sentMessages.length = 0;

    // Mock publicClient for on-chain status reads
    const mockPublicClient = {
      readContract: async (args: any) => {
        if (args.functionName === 'checkDefense') {
          // [defendable, currentICR, musdToRepay, btcToAdd]
          return [false, (165n * PRECISION) / 100n, 0n, 0n];
        }
        if (args.functionName === 'musdReserve') {
          return 1500n * PRECISION; // 1,500 MUSD
        }
        if (args.functionName === 'btcReserve') {
          return (5n * PRECISION) / 100n; // 0.05 BTC
        }
        if (args.functionName === 'rule') {
          // [enabled, triggerICR, targetICR, maxTipBps]
          return [true, (140n * PRECISION) / 100n, (150n * PRECISION) / 100n, 100];
        }
        if (args.functionName === 'Troves') {
          // [debt, coll, stake, status]
          return [2500n * PRECISION, (5n * PRECISION) / 100n, 0n, 1]; // active
        }
        if (args.functionName === 'fetchPrice') {
          return 80000n * PRECISION; // $80,000 / BTC
        }
        if (args.functionName === 'vaultOf' || args.functionName === 'predictVault') {
          return vaultAddress;
        }
        throw new Error(`Unhandled function: ${args.functionName}`);
      },
    } as any;

    botService = new TelegramBotService({
      token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      db,
      publicClient: mockPublicClient,
      factoryAddress,
      logger,
      botInfo: {
        id: 123456,
        is_bot: true,
        first_name: 'Ballast',
        username: 'BALLASTBTC_bot',
        can_join_groups: false,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
      },
    });

    // Intercept outgoing bot.api.sendMessage calls for test assertions
    botService.bot.api.config.use(async (prev, method, payload: any, signal) => {
      if (method === 'sendMessage') {
        sentMessages.push({
          chatId: String(payload.chat_id),
          text: String(payload.text),
        });
        return {
          ok: true,
          result: {
            message_id: sentMessages.length,
            date: Math.floor(Date.now() / 1000),
            chat: { id: payload.chat_id, type: 'private' },
            text: payload.text,
          },
        } as any;
      }
      return prev(method, payload, signal);
    });
  });

  async function dispatchCommand(text: string, fromChatId: number = chatId) {
    const commandWord = text.split(' ')[0];
    await botService.bot.handleUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        date: Math.floor(Date.now() / 1000),
        chat: { id: fromChatId, type: 'private' },
        from: { id: fromChatId, is_bot: false, first_name: 'Tester' },
        text,
        entities: [
          {
            type: 'bot_command',
            offset: 0,
            length: commandWord.length,
          },
        ],
      },
    } as any);
  }

  it('handles /start <token> by recording chat against pending token', async () => {
    const token = 'start-test-token-12345';
    db.createLinkToken(token, Date.now() + 600000);

    await dispatchCommand(`/start ${token}`);

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toContain('chat registered for link token');

    const record = db.getLinkToken(token);
    expect(record?.chatId).toBe(String(chatId));
  });

  it('handles /start with invalid or expired token', async () => {
    await dispatchCommand('/start expired-or-invalid-token');

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toContain('Invalid or expired link token');
  });

  it('handles /watch <percent> command to update alert threshold', async () => {
    db.linkTelegramUser(String(chatId), ownerAddress);

    await dispatchCommand('/watch 155');

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toContain('Watch alert level updated to 155.0%');

    const users = db.getTelegramUserByChat(String(chatId));
    expect(users[0].watchPercent).toBe(155.0);
  });

  it('handles /mute <hours> and /unmute commands', async () => {
    db.linkTelegramUser(String(chatId), ownerAddress);

    await dispatchCommand('/mute 4');

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toContain('Alerts muted for 4 hours');

    let users = db.getTelegramUserByChat(String(chatId));
    expect(users[0].mutedUntil).toBeGreaterThan(Date.now());

    await dispatchCommand('/unmute');
    expect(sentMessages.length).toBe(2);
    expect(sentMessages[1].text).toContain('Alerts unmuted');

    users = db.getTelegramUserByChat(String(chatId));
    expect(users[0].mutedUntil).toBe(0);
  });

  it('handles /status command outputting live metrics and reserves', async () => {
    db.saveVault({
      address: vaultAddress,
      owner: ownerAddress,
      createdBlock: 16251640,
      txHash: '0x123',
      discoveredAt: new Date().toISOString(),
    });
    db.linkTelegramUser(String(chatId), ownerAddress, 150.0);

    await dispatchCommand('/status');

    expect(sentMessages.length).toBe(1);
    const reply = sentMessages[0].text;

    expect(reply).toContain(`Vault: ${vaultAddress}`);
    expect(reply).toContain('Status: Active');
    expect(reply).toContain('ICR: 165.0%');
    expect(reply).toContain('Trigger: 140.0%');
    expect(reply).toContain('Watch: 150.0%');
    expect(reply).toContain('Liquidation Price: $55,000.00');
    expect(reply).toContain('MUSD Reserve: 1,500.00 MUSD');
    expect(reply).toContain('BTC Reserve: 0.0500 BTC');
    expect(reply).toContain('Defense Capacity:');
    expect(reply).toContain('https://explorer.test.mezo.org/address/');
  });

  it('handles /unlink command removing user data completely', async () => {
    db.linkTelegramUser(String(chatId), ownerAddress);
    expect(db.getTelegramUserByChat(String(chatId)).length).toBe(1);

    await dispatchCommand('/unlink');

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toContain('Unlinked successfully');
    expect(db.getTelegramUserByChat(String(chatId)).length).toBe(0);
  });

  it('handles /help command listing all bot commands', async () => {
    await dispatchCommand('/help');

    expect(sentMessages.length).toBe(1);
    const text = sentMessages[0].text;
    expect(text).toContain('/status');
    expect(text).toContain('/watch');
    expect(text).toContain('/mute');
    expect(text).toContain('/unmute');
    expect(text).toContain('/unlink');
  });

  it('delivers queued outbox notifications through botService', async () => {
    db.enqueueNotification('outbox-bot-test-key', String(chatId), 'Real alert delivered via Outbox');

    const worker = new NotificationOutboxWorker(db, botService, logger);
    const processed = await worker.processBatch();

    expect(processed).toBe(1);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].text).toBe('Real alert delivered via Outbox');

    const pending = db.getPendingNotifications();
    expect(pending.length).toBe(0);
  });
});
