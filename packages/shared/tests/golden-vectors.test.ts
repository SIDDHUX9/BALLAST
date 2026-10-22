import { describe, it, expect } from 'vitest';
import goldenVectors from './golden-vectors.json';
import {
  computeICR,
  computeRepayNeeded,
  computeCollateralNeeded,
  computeLiquidationPrice,
  computeTip,
} from '../src/math.js';

describe('Golden Vectors (Foundry / Solidity Parity)', () => {
  for (const v of goldenVectors) {
    it(`verifies: ${v.name}`, () => {
      const coll = BigInt(v.collateral);
      const price = BigInt(v.price);
      const debt = BigInt(v.debt);
      const mcr = BigInt(v.mcr);
      const targetICR = BigInt(v.targetICR);
      const minNetDebt = BigInt(v.minNetDebt);
      const musdReserve = BigInt(v.musdReserve);
      const btcReserve = BigInt(v.btcReserve);

      // 1. ICR
      const icr = computeICR(coll, debt, price);
      expect(icr.toString()).toBe(v.expectedICR);

      // 2. Liquidation Price
      const liqPrice = computeLiquidationPrice(coll, debt, mcr);
      expect(liqPrice.toString()).toBe(v.expectedLiquidationPrice);

      // 3. Repay Needed
      const { musdToRepay, remainingDebt } = computeRepayNeeded(
        coll,
        debt,
        price,
        targetICR,
        minNetDebt,
        musdReserve,
      );
      expect(musdToRepay.toString()).toBe(v.expectedRepayNeeded);

      // 4. Collateral Needed
      const btcNeeded = computeCollateralNeeded(
        coll,
        remainingDebt,
        price,
        targetICR,
        btcReserve,
      );
      expect(btcNeeded.toString()).toBe(v.expectedBtcNeeded);

      // 5. Tip on repay if any
      if (musdToRepay > 0n) {
        const tip = computeTip(musdToRepay, 50);
        expect(tip.toString()).toBe(v.expectedTip50Bps);
      } else if (btcNeeded > 0n) {
        const tip = computeTip(btcNeeded, 50);
        expect(tip.toString()).toBe(v.expectedTip50Bps);
      }
    });
  }
});
