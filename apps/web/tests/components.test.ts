import { describe, it, expect } from 'vitest';
import {
  computeICR,
  computeLiquidationPrice,
  computeRepayNeeded,
  computeCollateralNeeded,
  PROTOCOL_CONSTANTS,
} from '@ballast/shared';

describe('Landing Page & Health Gauge Math Integration', () => {
  it('calculates sound ratio and liquidation floor correctly', () => {
    const collWei = 2n * 10n ** 18n; // 2 BTC
    const priceWei = 68000n * 10n ** 18n; // $68,000 / BTC
    const debtWei = 60000n * 10n ** 18n; // 60,000 MUSD

    const icr = computeICR(collWei, debtWei, priceWei);
    const icrPercent = Number(icr) / 1e16;
    expect(icrPercent).toBeCloseTo(226.66, 1);

    const liqPrice = computeLiquidationPrice(collWei, debtWei, PROTOCOL_CONSTANTS.MCR);
    const liqPriceUsd = Number(liqPrice) / 1e18;
    // liqPrice = (60000 * 1.1) / 2 = $33,000
    expect(liqPriceUsd).toBe(33000);
  });

  it('calculates deficit repayment when position is below target', () => {
    const collWei = 1n * 10n ** 18n; // 1 BTC
    const priceWei = 50000n * 10n ** 18n; // $50,000
    const debtWei = 40000n * 10n ** 18n; // ICR = 125%
    const targetICR = 180n * 10n ** 16n; // 180%
    const minNetDebt = PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT;
    const reserve = 100000n * 10n ** 18n;

    const result = computeRepayNeeded(collWei, debtWei, priceWei, targetICR, minNetDebt, reserve);
    expect(result.musdToRepay).toBeGreaterThan(0n);
    expect(result.remainingDebt).toBeLessThan(debtWei);
  });

  it('calculates collateral addition needed to reach target', () => {
    const collWei = 1n * 10n ** 18n; // 1 BTC
    const priceWei = 50000n * 10n ** 18n; // $50,000
    const debtWei = 40000n * 10n ** 18n; // ICR = 125%
    const targetICR = 180n * 10n ** 16n; // 180%
    const reserve = 10n * 10n ** 18n;

    const collNeeded = computeCollateralNeeded(collWei, debtWei, priceWei, targetICR, reserve);
    expect(collNeeded).toBeGreaterThan(0n);
  });
});
