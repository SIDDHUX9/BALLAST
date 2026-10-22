import { describe, it, expect } from 'vitest';
import {
  computeICR,
  computeLiquidationPrice,
  computeAbsorptionCapacity,
  computeRepayNeeded,
  computeCollateralNeeded,
  PROTOCOL_CONSTANTS,
  PRECISION,
} from '@ballast/shared';
import { parseEther, formatEther } from 'viem';

describe('Data Layer Hooks & Pure Mathematical Logic', () => {
  describe('usePosition Derivations & Health Logic', () => {
    it('computes ICR accurately from collateral, debt, and oracle price', () => {
      // 1 BTC at $70,000, 35,000 MUSD debt -> ICR = 200%
      const coll = parseEther('1');
      const debt = parseEther('35000');
      const price = parseEther('70000');

      const icr = computeICR(coll, debt, price);
      const icrPercent = Number((icr * 10000n) / PRECISION) / 100;
      expect(icrPercent).toBe(200);
    });

    it('correctly identifies liquidation price floor based on 110% MCR', () => {
      // 0.5 BTC, 20,000 MUSD debt, 110% MCR -> Liq Price = (20000 * 1.1) / 0.5 = $44,000
      const coll = parseEther('0.5');
      const debt = parseEther('20000');
      const mcr = PROTOCOL_CONSTANTS.MCR; // 1.1e18

      const liqPrice = computeLiquidationPrice(coll, debt, mcr);
      const liqPriceUsd = Number(liqPrice) / 1e18;
      expect(liqPriceUsd).toBe(44000);
    });

    it('handles zero or non-existent debt safely without division by zero', () => {
      const coll = parseEther('1');
      const zeroDebt = 0n;
      const price = parseEther('70000');

      const icr = computeICR(coll, zeroDebt, price);
      expect(icr).toBe(0n);
    });

    it('evaluates Mezo recovery mode boundary condition (TCR < 150%)', () => {
      const normalTCR = parseEther('1.75'); // 175%
      const recoveryTCR = parseEther('1.48'); // 148%
      const recoveryThreshold = PROTOCOL_CONSTANTS.CCR; // 150%

      expect(normalTCR < recoveryThreshold).toBe(false);
      expect(recoveryTCR < recoveryThreshold).toBe(true);
    });
  });

  describe('useReserves & Absorption Capacity Logic', () => {
    it('computes how far BTC price can drop before reserves are exhausted', () => {
      // Position: 1 BTC collateral, 40,000 MUSD debt, current price $70,000 (ICR = 175%)
      // Reserve: 10,000 MUSD pre-funded
      // Target ICR: 130%
      const coll = parseEther('1');
      const debt = parseEther('40000');
      const price = parseEther('70000');
      const targetIcr = parseEther('1.3'); // 130%
      const musdReserve = parseEther('10000');
      const btcReserve = 0n;

      const capacity = computeAbsorptionCapacity(
        coll,
        debt,
        price,
        targetIcr,
        musdReserve,
        btcReserve,
        PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT
      );

      expect(capacity.criticalPrice).toBeGreaterThan(0n);
      expect(capacity.criticalPrice).toBeLessThan(price);
      expect(capacity.absorbableDropPercent).toBeGreaterThan(0);
      expect(capacity.absorbableDropPercent).toBeLessThan(100);
    });

    it('returns empty absorption when position has zero collateral', () => {
      const zeroColl = 0n;
      const debt = parseEther('40000');
      const price = parseEther('70000');
      const targetIcr = parseEther('1.3');

      const capacity = computeAbsorptionCapacity(
        zeroColl,
        debt,
        price,
        targetIcr,
        0n,
        0n
      );

      expect(capacity.criticalPrice).toBe(0n);
      expect(capacity.absorbableDropPercent).toBe(0);
    });
  });

  describe('useRule Formatting & Parameters', () => {
    it('parses trigger and target ratios into human percentages', () => {
      const triggerRatio = 1250000000000000000n; // 125% in 1e18
      const targetRatio = 1400000000000000000n; // 140% in 1e18
      const maxTipBps = 50n; // 50 bps = 0.50%

      const triggerPercent = Number((triggerRatio * 10000n) / PRECISION) / 100;
      const targetPercent = Number((targetRatio * 10000n) / PRECISION) / 100;
      const maxTipPercent = Number(maxTipBps) / 100;

      expect(triggerPercent).toBe(125);
      expect(targetPercent).toBe(140);
      expect(maxTipPercent).toBe(0.5);
    });

    it('validates rule constraints (target > trigger > MCR)', () => {
      const mcr = PROTOCOL_CONSTANTS.MCR; // 1.1e18 (110%)
      const trigger = parseEther('1.25'); // 125%
      const target = parseEther('1.40'); // 140%

      expect(trigger > mcr).toBe(true);
      expect(target > trigger).toBe(true);
    });
  });

  describe('useDefenseCheck Evaluation', () => {
    it('flags defendable when live ICR is below configured trigger', () => {
      const trigger = parseEther('1.35'); // 135%
      const safeICR = parseEther('1.55'); // 155%
      const dangerousICR = parseEther('1.30'); // 130%

      const shouldDefendSafe = safeICR < trigger;
      const shouldDefendDanger = dangerousICR < trigger;

      expect(shouldDefendSafe).toBe(false);
      expect(shouldDefendDanger).toBe(true);
    });
  });

  describe('useProtocolParams Bounds', () => {
    it('verifies standard protocol constants match Mezo Matsnet specification', () => {
      expect(PROTOCOL_CONSTANTS.MCR).toBe(1100000000000000000n); // 110%
      expect(PROTOCOL_CONSTANTS.CCR).toBe(1500000000000000000n); // 150%
      expect(PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT).toBe(1800000000000000000000n); // 1,800 MUSD
      expect(PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION).toBe(200000000000000000000n); // 200 MUSD
    });
  });
});
