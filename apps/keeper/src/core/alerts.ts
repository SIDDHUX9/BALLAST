import { formatEther, type Address } from 'viem';
import {
  BRAND_NAME,
  computeAbsorptionCapacity,
  computeLiquidationPrice,
  PRECISION,
} from '@ballast/shared';
import type { StoreInterface, Clock } from './types.js';
import type {
  DefenseExecutedAlertData,
  WarningAlertData,
  ReserveLowAlertData,
  DefenseFailedAlertData,
  PositionEndedAlertData,
  OperationalAlertData,
} from '../telegram/types.js';

export const MEZO_EXPLORER_BASE = 'https://explorer.test.mezo.org';

export class AlertEvaluator {
  private store: StoreInterface;
  private reserveLowThresholdPercent: number;
  private nowFn: Clock;

  constructor(
    store: StoreInterface,
    reserveLowThresholdPercent: number = 15.0,
    nowFn: Clock = () => Date.now(),
  ) {
    this.store = store;
    this.reserveLowThresholdPercent = reserveLowThresholdPercent;
    this.nowFn = nowFn;
  }

  /**
   * Evaluates warning alert with hysteresis:
   * Fires when ICR < watchLevel.
   * Disarms until ICR recovers >= watchLevel + 2.0 percentage points.
   */
  public async evaluateWarningAlert(data: WarningAlertData): Promise<boolean> {
    const { vault, currentIcr, watchLevelPercent, triggerIcrPercent, liquidationPrice } = data;
    const icrPercent = Number((currentIcr * 10000n) / PRECISION) / 100;
    const alertKey = 'warning';

    const state = (await this.store.getAlertState(vault, alertKey)) ?? {
      id: `${vault.toLowerCase()}:${alertKey}`,
      vault,
      alertType: alertKey,
      armed: true,
      lastValue: null,
      lastSentAt: 0,
    };

    // If disarmed, check if it has recovered +2% above watchLevel
    if (!state.armed) {
      if (icrPercent >= watchLevelPercent + 2.0) {
        await this.store.setAlertState(vault, alertKey, true, icrPercent.toFixed(2), this.nowFn());
      }
      return false;
    }

    // If armed and ICR fell below watchLevel, trigger alert
    if (icrPercent < watchLevelPercent) {
      const now = this.nowFn();
      await this.store.setAlertState(vault, alertKey, false, icrPercent.toFixed(2), now);

      const users = await this.store.getTelegramUsersForVault(vault);
      if (users.length === 0) return true;

      const message = [
        `WARNING: ICR below watch level`,
        `Vault: ${vault}`,
        `Current ICR: ${icrPercent.toFixed(1)}%`,
        `Watch Level: ${watchLevelPercent.toFixed(1)}%`,
        `Defense Trigger: ${triggerIcrPercent.toFixed(1)}%`,
        `Liquidation Price: $${(Number(formatEther(liquidationPrice))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Explorer: ${MEZO_EXPLORER_BASE}/address/${vault}`,
      ].join('\n');

      for (const user of users) {
        const idempotencyKey = `warning:${vault.toLowerCase()}:${user.chatId}:${now}:${icrPercent.toFixed(2)}`;
        await this.store.queueNotification({
          idempotencyKey,
          chatId: user.chatId,
          message,
        });
      }
      return true;
    }

    return false;
  }

  /**
   * Emits Defense Executed alert with before/after ICR, amounts, tips, reserves, and tx explorer link.
   */
  public async emitDefenseExecutedAlert(data: DefenseExecutedAlertData): Promise<void> {
    const {
      vault,
      oldIcr,
      newIcr,
      musdRepaid,
      btcAdded,
      musdTip,
      btcTip,
      remainingMusd,
      remainingBtc,
      txHash,
    } = data;

    const oldIcrPct = (Number((oldIcr * 10000n) / PRECISION) / 100).toFixed(1);
    const newIcrPct = (Number((newIcr * 10000n) / PRECISION) / 100).toFixed(1);

    const musdRepaidStr = Number(formatEther(musdRepaid)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const btcAddedStr = Number(formatEther(btcAdded)).toFixed(4);

    const musdTipStr = Number(formatEther(musdTip)).toFixed(2);
    const btcTipStr = Number(formatEther(btcTip)).toFixed(4);

    const remainingMusdStr = Number(formatEther(remainingMusd)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const remainingBtcStr = Number(formatEther(remainingBtc)).toFixed(4);

    const message = [
      `DEFENSE EXECUTED`,
      `Vault: ${vault}`,
      `ICR Before: ${oldIcrPct}%`,
      `ICR After: ${newIcrPct}%`,
      `Amounts Used: ${musdRepaidStr} MUSD, ${btcAddedStr} BTC`,
      `Tip Paid: ${musdTipStr} MUSD, ${btcTipStr} BTC`,
      `Remaining Reserves: ${remainingMusdStr} MUSD, ${remainingBtcStr} BTC`,
      `Transaction: ${MEZO_EXPLORER_BASE}/tx/${txHash}`,
    ].join('\n');

    const users = await this.store.getTelegramUsersForVault(vault);
    for (const user of users) {
      const idempotencyKey = `defense_executed:${txHash.toLowerCase()}:${user.chatId}`;
      await this.store.queueNotification({
        idempotencyKey,
        chatId: user.chatId,
        message,
      });
    }
  }

  /**
   * Evaluates reserve low condition:
   * Capacity expressed as 'a further X% BTC drop can be absorbed' computed with shared math.
   * Hysteresis re-arms when capacity recovers 5% above threshold.
   */
  public async evaluateReserveLowAlert(data: ReserveLowAlertData): Promise<boolean> {
    const { vault, currentIcr, absorbableDropPercent, musdReserve, btcReserve } = data;
    const alertKey = 'reserve_low';

    const state = (await this.store.getAlertState(vault, alertKey)) ?? {
      id: `${vault.toLowerCase()}:${alertKey}`,
      vault,
      alertType: alertKey,
      armed: true,
      lastValue: null,
      lastSentAt: 0,
    };

    if (!state.armed) {
      if (absorbableDropPercent >= this.reserveLowThresholdPercent + 5.0) {
        await this.store.setAlertState(vault, alertKey, true, absorbableDropPercent.toFixed(2), this.nowFn());
      }
      return false;
    }

    if (absorbableDropPercent < this.reserveLowThresholdPercent) {
      await this.store.setAlertState(vault, alertKey, false, absorbableDropPercent.toFixed(2), this.nowFn());

      const users = await this.store.getTelegramUsersForVault(vault);
      if (users.length === 0) return true;

      const icrPct = (Number((currentIcr * 10000n) / PRECISION) / 100).toFixed(1);
      const musdStr = Number(formatEther(musdReserve)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const btcStr = Number(formatEther(btcReserve)).toFixed(4);

      const message = [
        `RESERVE LOW`,
        `Vault: ${vault}`,
        `Remaining Capacity: a further ${absorbableDropPercent.toFixed(1)}% BTC drop can be absorbed`,
        `Current ICR: ${icrPct}%`,
        `MUSD Reserve: ${musdStr} MUSD`,
        `BTC Reserve: ${btcStr} BTC`,
        `Please deposit additional reserves to maintain automatic protection.`,
        `Explorer: ${MEZO_EXPLORER_BASE}/address/${vault}`,
      ].join('\n');

      const timeBucket = Math.floor(this.nowFn() / (4 * 3600 * 1000)); // 4h rate limit
      for (const user of users) {
        const idempotencyKey = `reserve_low:${vault.toLowerCase()}:${user.chatId}:${timeBucket}`;
        await this.store.queueNotification({
          idempotencyKey,
          chatId: user.chatId,
          message,
        });
      }
      return true;
    }

    return false;
  }

  /**
   * Defense failed or impossible (reserves empty, circuit breaker open).
   */
  public async emitDefenseFailedAlert(data: DefenseFailedAlertData): Promise<void> {
    const { vault, currentIcr, triggerIcrPercent, reason } = data;
    const icrPct = (Number((currentIcr * 10000n) / PRECISION) / 100).toFixed(1);

    const message = [
      `DEFENSE IMPOSSIBLE`,
      `Vault: ${vault}`,
      `Current ICR: ${icrPct}% (Trigger: ${triggerIcrPercent.toFixed(1)}%)`,
      `Reason: ${reason}`,
      `Action Required: Add collateral or repay debt immediately.`,
      `Explorer: ${MEZO_EXPLORER_BASE}/address/${vault}`,
    ].join('\n');

    const users = await this.store.getTelegramUsersForVault(vault);
    const timeBucket = Math.floor(this.nowFn() / (3600 * 1000)); // 1h rate limit
    for (const user of users) {
      const idempotencyKey = `defense_failed:${vault.toLowerCase()}:${user.chatId}:${timeBucket}`;
      await this.store.queueNotification({
        idempotencyKey,
        chatId: user.chatId,
        message,
      });
    }
  }

  /**
   * Position ended (trove liquidated, redeemed, or closed).
   */
  public async emitPositionEndedAlert(data: PositionEndedAlertData): Promise<void> {
    const { vault, status, txHash } = data;

    let statusText = 'Trove Closed';
    if (status === 'closedByLiquidation') {
      statusText = 'Trove Liquidated on Mezo';
    } else if (status === 'closedByRedemption') {
      statusText = 'Trove Redeemed on Mezo';
    } else if (status === 'closedByOwner') {
      statusText = 'Trove Closed by Owner';
    }

    const lines = [
      `POSITION ENDED`,
      `Vault: ${vault}`,
      `Status: ${statusText}`,
      `Explorer: ${MEZO_EXPLORER_BASE}/address/${vault}`,
    ];

    if (txHash) {
      lines.push(`Transaction: ${MEZO_EXPLORER_BASE}/tx/${txHash}`);
    }

    const message = lines.join('\n');
    const users = await this.store.getTelegramUsersForVault(vault);
    for (const user of users) {
      const idempotencyKey = `position_ended:${vault.toLowerCase()}:${status}:${user.chatId}`;
      await this.store.queueNotification({
        idempotencyKey,
        chatId: user.chatId,
        message,
      });
    }
  }

  /**
   * Operational alert: keeper paused or recovered (sent sparingly only to users with open positions).
   */
  public async emitOperationalAlert(data: OperationalAlertData, activeVaults: Address[]): Promise<void> {
    const { type, reason } = data;
    const isPaused = type === 'paused';

    const header = isPaused
      ? `OPERATIONAL NOTICE: ${BRAND_NAME} Keeper Paused`
      : `OPERATIONAL NOTICE: ${BRAND_NAME} Keeper Resumed`;

    const body = isPaused
      ? `The automated defense keeper has temporarily paused operations${reason ? ` (${reason})` : ''}. Your vault remains on-chain. Please monitor your collateral ratio manually.`
      : `The automated defense keeper has resumed normal monitoring and defense operations.`;

    const message = `${header}\n\n${body}`;
    const dayBucket = Math.floor(this.nowFn() / (86400 * 1000));

    // Send only to users with active vaults
    const notifiedChats = new Set<string>();
    for (const vault of activeVaults) {
      const users = await this.store.getTelegramUsersForVault(vault);
      for (const u of users) {
        if (!notifiedChats.has(u.chatId)) {
          notifiedChats.add(u.chatId);
          const idempotencyKey = `operational:${type}:${u.chatId}:${dayBucket}`;
          await this.store.queueNotification({
            idempotencyKey,
            chatId: u.chatId,
            message,
          });
        }
      }
    }
  }
}
