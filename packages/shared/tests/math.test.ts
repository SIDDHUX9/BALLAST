import { describe, it, expect } from 'vitest';
import {
  computeICR,
  computeRepayNeeded,
  computeCollateralNeeded,
  computeLiquidationPrice,
  computeTip,
  PRECISION,
} from '../src/math.js';

describe('Ballast Math Library', () => {
  const price = 80000n * PRECISION; // $80,000 / BTC
  const mcr = 1100000000000000000n; // 110%
  const minNetDebt = 1800n * PRECISION; // 1,800 MUSD

  it('computes ICR correctly with 1e18 precision', () => {
    // 0.05 BTC at $80,000 = $4,000 collateral
    // Debt = 2,500 MUSD
    // ICR = 4,000 / 2,500 = 160% (1.6e18)
    const coll = (5n * PRECISION) / 100n; // 0.05 BTC
    const debt = 2500n * PRECISION;
    const icr = computeICR(coll, debt, price);
    expect(icr).toBe(1600000000000000000n);
  });

  it('computes debt repayment needed to reach targetICR', () => {
    // Collateral = 0.05 BTC ($4,000)
    // Debt = 3,000 MUSD (ICR = 4000/3000 = 133.33%)
    // Target ICR = 150% (1.5e18)
    // Target Debt = 4000 / 1.5 = 2666.666... MUSD
    // idealRepay = 3000 - 2666 = 334 MUSD
    const coll = (5n * PRECISION) / 100n;
    const debt = 3000n * PRECISION;
    const targetICR = 1500000000000000000n; // 150%
    const musdReserve = 1000n * PRECISION;

    const { musdToRepay } = computeRepayNeeded(
      coll,
      debt,
      price,
      targetICR,
      minNetDebt,
      musdReserve,
    );

    // Target debt = floor((0.05 * 80000) / 1.5) = 2666.666666666666666666
    // Repay needed = 3000 - 2666.666... = ~333.33 MUSD
    expect(musdToRepay).toBeGreaterThan(333n * PRECISION);
    expect(musdToRepay).toBeLessThan(334n * PRECISION);
  });

  it('respects minNetDebt boundary and clamps repayment', () => {
    // Net debt = 1,900 MUSD (total debt = 2,100 MUSD with 200 gas comp)
    // If ideal repay is 300 MUSD, remaining net debt would be 1,600 (< 1,800 minNetDebt)
    // maxLegalRepay must clamp to 100 MUSD (1,900 - 1,800)
    const coll = (3n * PRECISION) / 100n;
    const debt = 2100n * PRECISION;
    const targetICR = 1500000000000000000n;
    const musdReserve = 1000n * PRECISION;

    const { musdToRepay } = computeRepayNeeded(
      coll,
      debt,
      price,
      targetICR,
      minNetDebt,
      musdReserve,
    );

    expect(musdToRepay).toBe(100n * PRECISION);
  });

  it('computes collateral addition needed to reach targetICR', () => {
    // Debt = 2,000 MUSD
    // Collateral = 0.02 BTC ($1,600) -> ICR = 80% (underwater)
    // Target ICR = 150% -> Target Collateral Value = 2,000 * 1.5 = $3,000
    // Required Collateral = $3,000 / $80,000 = 0.0375 BTC
    // Collateral Needed = 0.0375 - 0.02 = 0.0175 BTC
    const coll = (2n * PRECISION) / 100n;
    const debt = 2000n * PRECISION;
    const targetICR = 1500000000000000000n;
    const btcReserve = 1n * PRECISION;

    const btcNeeded = computeCollateralNeeded(coll, debt, price, targetICR, btcReserve);

    expect(btcNeeded).toBe((175n * PRECISION) / 10000n); // 0.0175 BTC
  });

  it('computes liquidation price accurately', () => {
    // Collateral = 0.05 BTC
    // Debt = 2,500 MUSD
    // MCR = 110% (1.1)
    // Liquidation Price = (2,500 * 1.1) / 0.05 = $55,000
    const coll = (5n * PRECISION) / 100n;
    const debt = 2500n * PRECISION;
    const liqPrice = computeLiquidationPrice(coll, debt, mcr);
    expect(liqPrice).toBe(55000n * PRECISION);
  });

  it('computes keeper tips bounded by maxTipBps', () => {
    const amount = 1000n * PRECISION;
    const tip50Bps = computeTip(amount, 50); // 0.50%
    expect(tip50Bps).toBe(5n * PRECISION);

    const tip100Bps = computeTip(amount, 100); // 1.00%
    expect(tip100Bps).toBe(10n * PRECISION);
  });
});
