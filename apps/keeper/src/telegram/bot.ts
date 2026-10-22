import { Bot, type Context } from 'grammy';
import type { Logger } from 'pino';
import {
  formatEther,
  type Address,
  type PublicClient,
} from 'viem';
import {
  BRAND_NAME,
  BallastVaultAbi,
  BallastFactoryAbi,
  computeLiquidationPrice,
  computeAbsorptionCapacity,
  MATSNET_PROTOCOL_ADDRESSES,
  PRECISION,
} from '@ballast/shared';
import type { KeeperDatabase } from '../db.js';
import type { OutboxSender } from './outbox.js';
import { MINIMAL_TROVE_MANAGER_ABI } from './types.js';
import { MEZO_EXPLORER_BASE } from './alerts.js';

export interface TelegramBotOptions {
  token: string;
  db: KeeperDatabase;
  publicClient: PublicClient;
  factoryAddress: Address;
  logger: Logger;
  botInfo?: import('grammy/types').UserFromGetMe;
}

export class TelegramBotService implements OutboxSender {
  public bot: Bot;
  private db: KeeperDatabase;
  private publicClient: PublicClient;
  private factoryAddress: Address;
  private logger: Logger;
  private isRunning: boolean = false;

  constructor(options: TelegramBotOptions) {
    this.db = options.db;
    this.publicClient = options.publicClient;
    this.factoryAddress = options.factoryAddress;
    this.logger = options.logger;

    this.bot = new Bot(
      options.token,
      options.botInfo ? { botInfo: options.botInfo } : undefined,
    );
    this.setupCommands();
  }

  private setupCommands(): void {
    // /start command (supports /start <token> for deep linking)
    this.bot.command('start', async (ctx) => {
      const token = ctx.match?.trim();
      const chatId = String(ctx.chat.id);

      if (token) {
        const linkToken = this.db.getLinkToken(token);
        if (!linkToken || linkToken.used || linkToken.expiresAt <= Date.now()) {
          await ctx.reply(
            'Invalid or expired link token. Please generate a new link in the Ballast web app.',
          );
          return;
        }

        const recorded = this.db.recordChatForToken(token, chatId);
        if (recorded) {
          await ctx.reply(
            'Telegram chat registered for link token.\nPlease return to Ballast and sign the verification message with your wallet to complete linking.',
          );
        } else {
          await ctx.reply('Failed to bind link token. Please try again.');
        }
        return;
      }

      // Plain /start without token
      const linked = this.db.getTelegramUserByChat(chatId);
      if (linked.length > 0) {
        const addresses = linked.map((u) => u.address).join(', ');
        await ctx.reply(
          `${BRAND_NAME} Alert Bot\nLinked wallet(s): ${addresses}\nUse /status to inspect your vaults, or /help for commands.`,
        );
      } else {
        await ctx.reply(
          `Welcome to ${BRAND_NAME} Alert Bot.\nTo link your wallet, connect your wallet at the ${BRAND_NAME} web app and select 'Link Telegram'.`,
        );
      }
    });

    // /status command: Live ICR, liquidation price, reserves, absorption capacity
    this.bot.command('status', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const userRows = this.db.getTelegramUserByChat(chatId);

      if (userRows.length === 0) {
        await ctx.reply(
          `No linked wallets found for this chat. Please connect your wallet in the ${BRAND_NAME} app and link Telegram.`,
        );
        return;
      }

      const statusReports: string[] = [];

      for (const user of userRows) {
        try {
          // Look up vault address
          let vaultAddress: Address | undefined;
          const knownVaults = this.db.getAllVaults().filter(
            (v) => v.owner.toLowerCase() === user.address.toLowerCase(),
          );

          if (knownVaults.length > 0) {
            vaultAddress = knownVaults[0].address;
          } else {
            // Predict or read from factory
            try {
              vaultAddress = (await this.publicClient.readContract({
                address: this.factoryAddress,
                abi: BallastFactoryAbi,
                functionName: 'vaultOf',
                args: [user.address],
              })) as Address;
            } catch {
              // Not yet deployed
            }
          }

          if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
            statusReports.push(`Wallet: ${user.address}\nVault: None deployed yet.`);
            continue;
          }

          // Read vault contract state
          const [checkRes, musdRes, btcRes, ruleRes] = await Promise.all([
            this.publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: 'checkDefense',
            }) as Promise<[boolean, bigint, bigint, bigint]>,
            this.publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: 'musdReserve',
            }) as Promise<bigint>,
            this.publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: 'btcReserve',
            }) as Promise<bigint>,
            this.publicClient.readContract({
              address: vaultAddress,
              abi: BallastVaultAbi,
              functionName: 'rule',
            }) as Promise<[boolean, bigint, bigint, number]>,
          ]);

          const icr = checkRes[1];
          const triggerICR = ruleRes[1];

          // Read Trove state from TroveManager
          const [debt, coll, troveStatus] = await Promise.all([
            this.publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
              abi: MINIMAL_TROVE_MANAGER_ABI,
              functionName: 'getTroveDebt',
              args: [vaultAddress],
            }) as Promise<bigint>,
            this.publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
              abi: MINIMAL_TROVE_MANAGER_ABI,
              functionName: 'getTroveColl',
              args: [vaultAddress],
            }) as Promise<bigint>,
            this.publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
              abi: MINIMAL_TROVE_MANAGER_ABI,
              functionName: 'getTroveStatus',
              args: [vaultAddress],
            }) as Promise<number>,
          ]);

          const mcr = 1100000000000000000n; // 110%
          const liqPrice = computeLiquidationPrice(coll, debt, mcr);

          // Get BTC price from PriceFeed
          let btcPrice = 0n;
          try {
            btcPrice = (await this.publicClient.readContract({
              address: MATSNET_PROTOCOL_ADDRESSES.priceFeed,
              abi: [
                {
                  type: 'function',
                  name: 'fetchPrice',
                  inputs: [],
                  outputs: [{ name: '', type: 'uint256' }],
                  stateMutability: 'view',
                },
              ],
              functionName: 'fetchPrice',
            })) as bigint;
          } catch {
            // fallback if unavailable
          }

          const capacity = computeAbsorptionCapacity(
            coll,
            debt,
            btcPrice,
            triggerICR,
            musdRes,
            btcRes,
          );

          const icrPct = (Number((icr * 10000n) / PRECISION) / 100).toFixed(1);
          const triggerPct = (Number((triggerICR * 10000n) / PRECISION) / 100).toFixed(1);
          const watchPct = (
            user.watchPercent ?? Number(triggerPct) + 10
          ).toFixed(1);

          const liqPriceFormatted = Number(formatEther(liqPrice)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

          const musdResFormatted = Number(formatEther(musdRes)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const btcResFormatted = Number(formatEther(btcRes)).toFixed(4);

          let statusStr = 'Active';
          if (troveStatus === 2) statusStr = 'Closed by Owner';
          if (troveStatus === 3) statusStr = 'Liquidated';
          if (troveStatus === 4) statusStr = 'Redeemed';

          const report = [
            `Vault: ${vaultAddress}`,
            `Status: ${statusStr}`,
            `ICR: ${icrPct}% (Trigger: ${triggerPct}%, Watch: ${watchPct}%)`,
            `Liquidation Price: $${liqPriceFormatted}`,
            `MUSD Reserve: ${musdResFormatted} MUSD`,
            `BTC Reserve: ${btcResFormatted} BTC`,
            `Defense Capacity: a further ${capacity.absorbableDropPercent.toFixed(1)}% BTC drop can be absorbed`,
            `Explorer: ${MEZO_EXPLORER_BASE}/address/${vaultAddress}`,
          ].join('\n');

          statusReports.push(report);
        } catch (err) {
          statusReports.push(`Wallet: ${user.address}\nError reading vault status: ${String(err)}`);
        }
      }

      await ctx.reply(statusReports.join('\n\n'));
    });

    // /watch <percent>
    this.bot.command('watch', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const text = ctx.match?.trim();

      if (!text) {
        await ctx.reply('Usage: /watch <percent>\nExample: /watch 145');
        return;
      }

      const percent = parseFloat(text.replace('%', ''));
      if (isNaN(percent) || percent < 110 || percent > 500) {
        await ctx.reply('Invalid percentage. Watch level must be between 110% and 500%.');
        return;
      }

      this.db.updateWatchPercent(chatId, percent);
      await ctx.reply(
        `Watch alert level updated to ${percent.toFixed(1)}%.\nYou will be alerted if your ICR drops below this level.`,
      );
    });

    // /mute <hours>
    this.bot.command('mute', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const text = ctx.match?.trim();

      if (!text) {
        await ctx.reply('Usage: /mute <hours>\nExample: /mute 4');
        return;
      }

      const hours = parseInt(text, 10);
      if (isNaN(hours) || hours < 1 || hours > 168) {
        await ctx.reply('Invalid duration. Mute period must be between 1 and 168 hours (1 week).');
        return;
      }

      const mutedUntil = Date.now() + hours * 3600 * 1000;
      this.db.setMute(chatId, mutedUntil);
      const dateStr = new Date(mutedUntil).toUTCString();

      await ctx.reply(`Alerts muted for ${hours} hours (until ${dateStr}).`);
    });

    // /unmute
    this.bot.command('unmute', async (ctx) => {
      const chatId = String(ctx.chat.id);
      this.db.setMute(chatId, 0);
      await ctx.reply('Alerts unmuted. You will receive active defense and warning alerts.');
    });

    // /unlink
    this.bot.command('unlink', async (ctx) => {
      const chatId = String(ctx.chat.id);
      this.db.unlinkChat(chatId);
      await ctx.reply(
        'Unlinked successfully. All wallet associations and alert preferences have been deleted.',
      );
    });

    // /help
    this.bot.command('help', async (ctx) => {
      const helpText = [
        `${BRAND_NAME} Alert Bot Commands:`,
        `/status - View live ICR, liquidation price, and reserves`,
        `/watch <percent> - Set custom warning ICR threshold`,
        `/mute <hours> - Temporarily mute alerts (1-168 hours)`,
        `/unmute - Unmute alerts immediately`,
        `/unlink - Delete chat and wallet link`,
        `/help - Show this command list`,
      ].join('\n');

      await ctx.reply(helpText);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.bot.start({
        onStart: (botInfo) => {
          this.logger.info({ username: botInfo.username }, 'Telegram bot started polling');
        },
      });
    } catch (err) {
      this.logger.error({ err }, 'Failed to start Telegram bot polling');
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    await this.bot.stop();
    this.logger.info('Telegram bot stopped polling');
  }

  public async sendMessage(chatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text, {
      link_preview_options: { is_disabled: true },
    });
  }
}
