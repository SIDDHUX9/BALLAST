/**
 * Pure mathematical functions for Ballast calculations.
 * Mirrors Solidity fixed-point 1e18 math and rounding rules specified in docs/SPEC.md.
 */

export const PRECISION = 10n ** 18n; // 1e18 == 100%
export const MUSD_GAS_COMPENSATION = 200n * 10n ** 18n; // 200 MUSD

/**
 * Computes Individual Collateral Ratio (ICR).
 * ICR = (collateral * price) / debt
 * Rounds DOWN (conservative for defense evaluation).
 */
export function computeICR(collateral: bigint, debt: bigint, price: bigint): bigint {
  if (debt === 0n) return 0n;
  return (collateral * price) / debt;
}

/**
 * Computes the debt repayment needed to reach targetICR.
 * Target debt = (collateral * price) / targetICR (rounded DOWN)
 * idealRepay = debt - targetDebt (rounded UP against the vault)
 * Clamped so remaining net debt never falls into (0, minNetDebt).
 */
export function computeRepayNeeded(
  collateral: bigint,
  debt: bigint,
  price: bigint,
  targetICR: bigint,
  minNetDebt: bigint,
  musdReserve: bigint,
): { musdToRepay: bigint; remainingDebt: bigint } {
  if (debt === 0n || targetICR === 0n) {
    return { musdToRepay: 0n, remainingDebt: debt };
  }

  // targetDebt = floor((collateral * price) / targetICR)
  const targetDebt = (collateral * price) / targetICR;
  if (debt <= targetDebt) {
    return { musdToRepay: 0n, remainingDebt: debt };
  }

  // ceil division for idealRepay: debt - targetDebt
  const idealRepay = debt - targetDebt;

  // Mezo MUSD net debt constraint:
  // netDebt = debt - MUSD_GAS_COMPENSATION
  const netDebt = debt > MUSD_GAS_COMPENSATION ? debt - MUSD_GAS_COMPENSATION : 0n;

  if (netDebt <= minNetDebt) {
    // Cannot repay any debt without dropping below minimum net debt or reverting
    return { musdToRepay: 0n, remainingDebt: debt };
  }

  const maxLegalRepay = netDebt - minNetDebt;
  let musdToRepay = idealRepay < maxLegalRepay ? idealRepay : maxLegalRepay;

  if (musdToRepay > musdReserve) {
    musdToRepay = musdReserve;
  }

  return {
    musdToRepay,
    remainingDebt: debt - musdToRepay,
  };
}

/**
 * Computes the native BTC collateral addition needed to reach targetICR.
 * requiredCollateral = ceil((targetICR * remainingDebt) / price)
 * collNeeded = requiredCollateral - collateral
 * Clamped by available btcReserve.
 */
export function computeCollateralNeeded(
  collateral: bigint,
  remainingDebt: bigint,
  price: bigint,
  targetICR: bigint,
  btcReserve: bigint,
): bigint {
  if (price === 0n || remainingDebt === 0n) return 0n;

  // ceil division: ((targetICR * remainingDebt) + price - 1) / price
  const numerator = targetICR * remainingDebt;
  const requiredCollateral = (numerator + price - 1n) / price;

  if (requiredCollateral <= collateral) {
    return 0n;
  }

  const idealBtcNeeded = requiredCollateral - collateral;
  return idealBtcNeeded < btcReserve ? idealBtcNeeded : btcReserve;
}

/**
 * Computes the price at which the trove would hit MCR (Liquidation Price).
 * liquidationPrice = ceil((debt * MCR) / collateral)
 */
export function computeLiquidationPrice(collateral: bigint, debt: bigint, mcr: bigint): bigint {
  if (collateral === 0n) return 0n;
  const numerator = debt * mcr;
  return (numerator + collateral - 1n) / collateral;
}

/**
 * Computes keeper tip in the asset moved.
 * Tip = floor((amount * maxTipBps) / 10000)
 */
export function computeTip(amount: bigint, maxTipBps: number): bigint {
  if (amount === 0n || maxTipBps <= 0) return 0n;
  return (amount * BigInt(maxTipBps)) / 10000n;
}

/**
 * Computes the maximum percentage BTC price drop that the vault's current collateral
 * plus available reserves can absorb before ICR drops below targetICR.
 * 
 * Reserves can repay debt down to minNetDebt + MUSD_GAS_COMPENSATION,
 * and add btcReserve to collateral.
 * 
 * criticalPrice = (targetICR * remainingDebt) / totalCollateral
 * absorbableDropPercent = max(0, (currentPrice - criticalPrice) / currentPrice * 100)
 */
export function computeAbsorptionCapacity(
  collateral: bigint,
  debt: bigint,
  currentPrice: bigint,
  targetICR: bigint,
  musdReserve: bigint,
  btcReserve: bigint,
  minNetDebt: bigint = 0n,
): { criticalPrice: bigint; absorbableDropPercent: number } {
  if (currentPrice === 0n || targetICR === 0n) {
    return { criticalPrice: 0n, absorbableDropPercent: 0 };
  }

  // Net debt calculation
  const netDebt = debt > MUSD_GAS_COMPENSATION ? debt - MUSD_GAS_COMPENSATION : 0n;
  const maxLegalRepay = netDebt > minNetDebt ? netDebt - minNetDebt : 0n;
  const repayAmount = musdReserve < maxLegalRepay ? musdReserve : maxLegalRepay;

  const remainingDebt = debt > repayAmount ? debt - repayAmount : 0n;
  const totalCollateral = collateral + btcReserve;

  if (totalCollateral === 0n) {
    return { criticalPrice: 0n, absorbableDropPercent: 0 };
  }

  if (remainingDebt === 0n) {
    return { criticalPrice: 0n, absorbableDropPercent: 100 };
  }

  const criticalPrice = (targetICR * remainingDebt) / totalCollateral;

  if (criticalPrice >= currentPrice) {
    return { criticalPrice, absorbableDropPercent: 0 };
  }

  const dropWei = currentPrice - criticalPrice;
  const absorbableDropPercent = Number((dropWei * 10000n) / currentPrice) / 100;

  return {
    criticalPrice,
    absorbableDropPercent,
  };
}
