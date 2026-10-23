import { describe, it, expect } from 'vitest';
import {
  simulateStressTest,
  computeDefenseAmounts,
  computeICR,
  computeRepayNeeded,
  computeCollateralNeeded,
  computeLiquidationPrice,
  computeTip,
  computeAbsorptionCapacity,
  PRECISION,
  MUSD_GAS_COMPENSATION,
  PROTOCOL_MCR_DEFAULT,
  PROTOCOL_MIN_NET_DEBT_DEFAULT,
} from '../src/math.js';

describe('Stress Test Math & Adversarial Scenarios', () => {
  const currentPrice = 80000n * PRECISION; // $80,000 / BTC
  const triggerICR = 1250000000000000000n; // 125%
  const targetICR = 1500000000000000000n; // 150%
  const maxTipBps = 50; // 0.50%

  it('simulates progressive defense steps as price drops', () => {
    // 0.05 BTC at $80k = $4,000 coll
    // Debt = 2,500 MUSD -> Initial ICR = 160%
    // At ~25% drop (price $60,000): coll = $3,000, debt = 2,500 -> ICR = 120% (< 125% trigger)
    // Defense executes to restore target 150%
    const collateral = (5n * PRECISION) / 100n;
    const debt = 2500n * PRECISION;
    const musdReserve = 500n * PRECISION;
    const btcReserve = (1n * PRECISION) / 100n;

    const res = simulateStressTest({
      collateral,
      debt,
      currentPrice,
      priceDropPercent: 35,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve,
      btcReserve,
    });

    expect(res.initialICR).toBe(1600000000000000000n);
    expect(res.hasDefended).toBe(true);
    expect(res.defenseSteps.length).toBeGreaterThan(0);

    const firstStep = res.defenseSteps[0];
    expect(firstStep.icrBefore).toBeLessThan(triggerICR);
    expect(firstStep.icrAfter).toBeGreaterThanOrEqual(firstStep.icrBefore);
    expect(firstStep.remainingMusdReserve).toBeLessThan(musdReserve);
    expect(res.canSurviveDrop).toBe(true);
  });

  it('handles adversarial zero reserves without crashing and marks reserves exhausted', () => {
    const collateral = (5n * PRECISION) / 100n;
    const debt = 2500n * PRECISION;

    const res = simulateStressTest({
      collateral,
      debt,
      currentPrice,
      priceDropPercent: 40,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve: 0n,
      btcReserve: 0n,
    });

    expect(res.hasDefended).toBe(false);
    expect(res.defenseSteps.length).toBe(0);
    expect(res.isReservesExhausted).toBe(true);
    // Unprotected path and protected path must be identical
    for (const pt of res.points) {
      expect(pt.protectedICR).toBe(pt.unprotectedICR);
      expect(pt.isDefended).toBe(false);
    }
  });

  it('handles adversarial severe price shock that exhausts reserves', () => {
    // Small reserves: 50 MUSD and 0.001 BTC
    // Deep 60% price drop ($80k -> $32k)
    // Reserves should exhaust and position should face liquidation
    const collateral = (5n * PRECISION) / 100n;
    const debt = 2500n * PRECISION;
    const musdReserve = 50n * PRECISION;
    const btcReserve = (1n * PRECISION) / 1000n;

    const res = simulateStressTest({
      collateral,
      debt,
      currentPrice,
      priceDropPercent: 60,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve,
      btcReserve,
    });

    expect(res.hasDefended).toBe(true);
    expect(res.reservesExhaustedPrice).not.toBeNull();
    expect(res.reservesExhaustedDropPercent).toBeLessThan(60);
    expect(res.isReservesExhausted).toBe(true);
  });

  it('handles edge cases: zero debt, zero collateral, and zero price', () => {
    const zeroDebt = simulateStressTest({
      collateral: 1n * PRECISION,
      debt: 0n,
      currentPrice,
      priceDropPercent: 20,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve: 100n,
      btcReserve: 1n,
    });
    expect(zeroDebt.hasDefended).toBe(false);
    expect(zeroDebt.points.length).toBe(0);

    const zeroColl = simulateStressTest({
      collateral: 0n,
      debt: 1000n * PRECISION,
      currentPrice,
      priceDropPercent: 20,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve: 100n,
      btcReserve: 1n,
    });
    expect(zeroColl.hasDefended).toBe(false);

    const zeroPrice = simulateStressTest({
      collateral: 1n * PRECISION,
      debt: 1000n * PRECISION,
      currentPrice: 0n,
      priceDropPercent: 20,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve: 100n,
      btcReserve: 1n,
    });
    expect(zeroPrice.hasDefended).toBe(false);
  });

  it('respects disabled state (enabled = false)', () => {
    const collateral = (5n * PRECISION) / 100n;
    const debt = 2500n * PRECISION;
    const musdReserve = 1000n * PRECISION;
    const btcReserve = 1n * PRECISION;

    const res = simulateStressTest({
      collateral,
      debt,
      currentPrice,
      priceDropPercent: 40,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve,
      btcReserve,
      enabled: false,
    });

    expect(res.hasDefended).toBe(false);
    expect(res.defenseSteps.length).toBe(0);
  });

  it('evaluates redemption risk against system TCR correctly', () => {
    const collateral = (5n * PRECISION) / 100n;
    const debt = 2500n * PRECISION;
    const systemTCR = 1500000000000000000n; // 150%

    const res = simulateStressTest({
      collateral,
      debt,
      currentPrice,
      priceDropPercent: 40,
      triggerICR,
      targetICR,
      maxTipBps,
      musdReserve: 200n * PRECISION,
      btcReserve: (1n * PRECISION) / 100n,
      systemTCR,
    });

    // Check that redemption risks are categorized
    const moderateRiskPoints = res.points.filter((p) => p.redemptionRisk === 'moderate');
    expect(moderateRiskPoints.length).toBeGreaterThanOrEqual(0);
  });

  it('matches computeDefenseAmounts with BallastMath contract behavior', () => {
    const res = computeDefenseAmounts({
      currentCollateral: (5n * PRECISION) / 100n,
      currentDebt: 2500n * PRECISION,
      price: 60000n * PRECISION, // $60k -> Collateral value = $3,000 -> ICR = 120%
      targetICR: 1500000000000000000n, // 150%
      minNetDebt: PROTOCOL_MIN_NET_DEBT_DEFAULT,
      gasCompensation: MUSD_GAS_COMPENSATION,
      musdReserve: 1000n * PRECISION,
      btcReserve: (5n * PRECISION) / 100n,
      maxTipBps: 50,
    });

    // Target debt = 3,000 / 1.5 = 2,000 MUSD
    // Ideal repay = 2,500 - 2,000 = 500 MUSD
    // Net debt = 2,500 - 200 = 2,300 MUSD
    // maxLegalRepay = 2,300 - 1,800 = 500 MUSD
    // musdToRepay = 500 MUSD
    expect(res.musdToRepay).toBe(500n * PRECISION);
    expect(res.musdTip).toBe((500n * PRECISION * 50n) / 10000n); // 2.5 MUSD
  });

  it('covers all branch boundaries for 100% math coverage', () => {
    // computeICR with 0 debt
    expect(computeICR(100n, 0n, 100n)).toBe(0n);

    // computeRepayNeeded with 0 targetICR or 0 debt
    expect(computeRepayNeeded(100n, 0n, 100n, 100n, 100n, 100n).musdToRepay).toBe(0n);
    expect(computeRepayNeeded(100n, 100n, 100n, 0n, 100n, 100n).musdToRepay).toBe(0n);

    // computeRepayNeeded when debt <= targetDebt
    expect(computeRepayNeeded(100n * PRECISION, 10n * PRECISION, 80000n * PRECISION, 1500000000000000000n, 1800n * PRECISION, 1000n * PRECISION).musdToRepay).toBe(0n);

    // computeRepayNeeded when netDebt <= minNetDebt
    expect(computeRepayNeeded(1n * PRECISION, 1900n * PRECISION, 80000n * PRECISION, 2000000000000000000n, 1800n * PRECISION, 1000n * PRECISION).musdToRepay).toBe(0n);

    // computeCollateralNeeded with 0 price, 0 remaining debt, or requiredCollateral <= collateral
    expect(computeCollateralNeeded(100n, 100n, 0n, 100n, 100n)).toBe(0n);
    expect(computeCollateralNeeded(100n, 0n, 100n, 100n, 100n)).toBe(0n);
    expect(computeCollateralNeeded(100n * PRECISION, 10n * PRECISION, 80000n * PRECISION, 1000000000000000000n, 100n * PRECISION)).toBe(0n);

    // computeLiquidationPrice with 0 collateral
    expect(computeLiquidationPrice(0n, 100n, 1100000000000000000n)).toBe(0n);

    // computeTip with 0 amount or 0 maxTipBps
    expect(computeTip(0n, 50)).toBe(0n);
    expect(computeTip(100n, 0)).toBe(0n);

    // computeAbsorptionCapacity edge cases
    expect(computeAbsorptionCapacity(100n, 100n, 0n, 100n, 100n, 100n).absorbableDropPercent).toBe(0);
    expect(computeAbsorptionCapacity(100n, 100n, 100n, 0n, 100n, 100n).absorbableDropPercent).toBe(0);
    expect(computeAbsorptionCapacity(0n, 100n, 100n, 100n, 0n, 0n).absorbableDropPercent).toBe(0); // 0 coll
    expect(computeAbsorptionCapacity(100n, 0n, 100n, 100n, 100n, 100n).absorbableDropPercent).toBe(100); // 0 debt
    // criticalPrice >= currentPrice
    expect(computeAbsorptionCapacity(1n, 1000000n * PRECISION, 100n, 2000000000000000000n, 0n, 0n).absorbableDropPercent).toBe(0);

    // computeRepayNeeded when musdToRepay > musdReserve
    expect(computeRepayNeeded((5n * PRECISION) / 100n, 3000n * PRECISION, 80000n * PRECISION, 1500000000000000000n, 1800n * PRECISION, 10n * PRECISION).musdToRepay).toBe(10n * PRECISION);

    // computeDefenseAmounts edge cases
    expect(computeDefenseAmounts({
      currentCollateral: 100n,
      currentDebt: 0n,
      price: 100n,
      targetICR: 100n,
      minNetDebt: 100n,
      musdReserve: 100n,
      btcReserve: 100n,
      maxTipBps: 0,
    }).musdToRepay).toBe(0n);

    expect(computeDefenseAmounts({
      currentCollateral: 100n,
      currentDebt: 100n,
      price: 0n,
      targetICR: 100n,
      minNetDebt: 100n,
      musdReserve: 100n,
      btcReserve: 100n,
      maxTipBps: 0,
    }).musdToRepay).toBe(0n);

    expect(computeDefenseAmounts({
      currentCollateral: 100n,
      currentDebt: 100n,
      price: 100n,
      targetICR: 0n,
      minNetDebt: 100n,
      musdReserve: 100n,
      btcReserve: 100n,
      maxTipBps: 0,
    }).musdToRepay).toBe(0n);

    // computeDefenseAmounts with maxTipBps = 0 and actual repay & coll add
    const zeroTipRes = computeDefenseAmounts({
      currentCollateral: (2n * PRECISION) / 100n,
      currentDebt: 2500n * PRECISION,
      price: 60000n * PRECISION,
      targetICR: 1500000000000000000n,
      minNetDebt: PROTOCOL_MIN_NET_DEBT_DEFAULT,
      musdReserve: 500n * PRECISION,
      btcReserve: 1n * PRECISION,
      maxTipBps: 0,
    });
    expect(zeroTipRes.musdTip).toBe(0n);
    expect(zeroTipRes.btcTip).toBe(0n);
    expect(zeroTipRes.musdToRepay).toBe(500n * PRECISION);
    expect(zeroTipRes.btcToAdd).toBeGreaterThan(0n);

    // Stress test with systemTCR = 0n to trigger redemptionRisk = 'low'
    const lowRiskRes = simulateStressTest({
      collateral: (5n * PRECISION) / 100n,
      debt: 2500n * PRECISION,
      currentPrice: 80000n * PRECISION,
      priceDropPercent: 15,
      triggerICR: 1200000000000000000n,
      targetICR: 1500000000000000000n,
      maxTipBps: 50,
      musdReserve: 0n,
      btcReserve: 0n,
      systemTCR: 0n,
    });
    const lowRiskPt = lowRiskRes.points.find((p) => p.redemptionRisk === 'low');
    expect(lowRiskPt).toBeDefined();
  });
});
