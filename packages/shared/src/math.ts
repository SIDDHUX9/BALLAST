/**
 * Pure mathematical functions for Ballast calculations.
 * Mirrors Solidity fixed-point 1e18 math and rounding rules specified in docs/SPEC.md.
 */

export const PRECISION = 10n ** 18n; // 1e18 == 100%
export const MUSD_GAS_COMPENSATION = 200n * 10n ** 18n; // 200 MUSD
export const PROTOCOL_MCR_DEFAULT = 1100000000000000000n; // 110%
export const PROTOCOL_MIN_NET_DEBT_DEFAULT = 1800n * 10n ** 18n; // 1,800 MUSD

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
 * Parameters for Ballast defense computation, mirroring BallastMath.sol struct.
 */
export interface DefenseAmountsParams {
  currentCollateral: bigint;
  currentDebt: bigint;
  price: bigint;
  targetICR: bigint;
  minNetDebt: bigint;
  gasCompensation?: bigint;
  musdReserve: bigint;
  btcReserve: bigint;
  maxTipBps: number;
}

export interface DefenseAmountsResult {
  musdToRepay: bigint;
  btcToAdd: bigint;
  musdTip: bigint;
  btcTip: bigint;
}

/**
 * Computes defense amounts according to BallastMath.sol on-chain logic.
 * Clamps repayments so that remaining net debt >= minNetDebt,
 * and accounts for tip overhead when bounding by reserves.
 */
export function computeDefenseAmounts(params: DefenseAmountsParams): DefenseAmountsResult {
  const {
    currentCollateral,
    currentDebt,
    price,
    targetICR,
    minNetDebt,
    gasCompensation = MUSD_GAS_COMPENSATION,
    musdReserve,
    btcReserve,
    maxTipBps,
  } = params;

  if (targetICR === 0n || price === 0n || currentDebt === 0n) {
    return { musdToRepay: 0n, btcToAdd: 0n, musdTip: 0n, btcTip: 0n };
  }

  // targetDebt = floor((currentCollateral * price) / targetICR)
  const targetDebt = (currentCollateral * price) / targetICR;
  const idealRepay = currentDebt > targetDebt ? currentDebt - targetDebt : 0n;

  // clampRepay:
  let musdToRepay = 0n;
  const netDebt = currentDebt > gasCompensation ? currentDebt - gasCompensation : 0n;
  if (netDebt > minNetDebt && idealRepay > 0n) {
    const maxLegalRepay = netDebt - minNetDebt;
    const maxReserveRepay =
      maxTipBps > 0
        ? (musdReserve * 10000n) / (10000n + BigInt(maxTipBps))
        : musdReserve;
    const repayCandidate = idealRepay < maxLegalRepay ? idealRepay : maxLegalRepay;
    musdToRepay = repayCandidate < maxReserveRepay ? repayCandidate : maxReserveRepay;
  }

  const musdTip = musdToRepay > 0n && maxTipBps > 0 ? (musdToRepay * BigInt(maxTipBps)) / 10000n : 0n;
  const remainingDebt = currentDebt > musdToRepay ? currentDebt - musdToRepay : 0n;

  // calculateCollateralNeeded:
  let btcToAdd = 0n;
  if (remainingDebt > 0n) {
    // ceil division: ((targetICR * remainingDebt) + price - 1) / price
    const requiredCollateral = ((targetICR * remainingDebt) + price - 1n) / price;
    if (requiredCollateral > currentCollateral) {
      const idealBtcToAdd = requiredCollateral - currentCollateral;
      const maxReserveBtc =
        maxTipBps > 0
          ? (btcReserve * 10000n) / (10000n + BigInt(maxTipBps))
          : btcReserve;
      btcToAdd = idealBtcToAdd < maxReserveBtc ? idealBtcToAdd : maxReserveBtc;
    }
  }

  const btcTip = btcToAdd > 0n && maxTipBps > 0 ? (btcToAdd * BigInt(maxTipBps)) / 10000n : 0n;

  return { musdToRepay, btcToAdd, musdTip, btcTip };
}

/**
 * Computes the maximum percentage BTC price drop that the vault's current collateral
 * plus available reserves can absorb before ICR drops below targetICR.
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

/**
 * Stress Test simulation parameters.
 */
export interface StressTestParams {
  collateral: bigint;
  debt: bigint;
  currentPrice: bigint;
  priceDropPercent: number; // e.g. 0 to 60
  triggerICR: bigint;
  targetICR: bigint;
  maxTipBps: number;
  musdReserve: bigint;
  btcReserve: bigint;
  minNetDebt?: bigint;
  gasCompensation?: bigint;
  mcr?: bigint;
  systemTCR?: bigint;
  enabled?: boolean;
}

export interface DefenseExecutionStep {
  stepIndex: number;
  price: bigint;
  dropPercent: number;
  icrBefore: bigint;
  musdRepaid: bigint;
  musdTip: bigint;
  btcAdded: bigint;
  btcTip: bigint;
  icrAfter: bigint;
  remainingMusdReserve: bigint;
  remainingBtcReserve: bigint;
}

export interface StressSimulationPoint {
  price: bigint;
  dropPercent: number;
  unprotectedICR: bigint;
  protectedICR: bigint;
  unprotectedLiqPrice: bigint;
  protectedLiqPrice: bigint;
  isLiquidatedUnprotected: boolean;
  isLiquidatedProtected: boolean;
  isDefended: boolean;
  remainingMusdReserve: bigint;
  remainingBtcReserve: bigint;
  redemptionRisk: 'none' | 'low' | 'moderate' | 'high';
}

export interface StressTestResult {
  initialPrice: bigint;
  targetPrice: bigint;
  initialICR: bigint;
  unprotectedLiqPrice: bigint;
  protectedLiqPrice: bigint;
  survivesDownToPrice: bigint;
  reservesExhaustedPrice: bigint | null;
  reservesExhaustedDropPercent: number | null;
  points: StressSimulationPoint[];
  defenseSteps: DefenseExecutionStep[];
  hasDefended: boolean;
  isReservesExhausted: boolean;
  canSurviveDrop: boolean;
  unprotectedSurvivesDrop: boolean;
}

/**
 * Pure simulation function for the Stress Test.
 * Verified against Solidity BallastMath logic with 1e18 fixed-point math.
 * Simulates step-by-step price drawdowns from 0% to maxDropPercent.
 */
export function simulateStressTest(params: StressTestParams): StressTestResult {
  const {
    collateral,
    debt,
    currentPrice,
    priceDropPercent,
    triggerICR,
    targetICR,
    maxTipBps,
    musdReserve,
    btcReserve,
    minNetDebt = PROTOCOL_MIN_NET_DEBT_DEFAULT,
    gasCompensation = MUSD_GAS_COMPENSATION,
    mcr = PROTOCOL_MCR_DEFAULT,
    systemTCR = 1500000000000000000n, // 150% default TCR
    enabled = true,
  } = params;

  const initialICR = computeICR(collateral, debt, currentPrice);
  const unprotectedLiqPrice = computeLiquidationPrice(collateral, debt, mcr);

  if (currentPrice === 0n || debt === 0n || collateral === 0n) {
    return {
      initialPrice: currentPrice,
      targetPrice: currentPrice,
      initialICR,
      unprotectedLiqPrice,
      protectedLiqPrice: unprotectedLiqPrice,
      survivesDownToPrice: unprotectedLiqPrice,
      reservesExhaustedPrice: null,
      reservesExhaustedDropPercent: null,
      points: [],
      defenseSteps: [],
      hasDefended: false,
      isReservesExhausted: true,
      canSurviveDrop: false,
      unprotectedSurvivesDrop: false,
    };
  }

  const maxDrop = Math.min(100, Math.max(0, Math.round(priceDropPercent)));
  const simEndDrop = Math.max(60, maxDrop);

  let currentColl = collateral;
  let currentDebt = debt;
  let currentMusdReserve = musdReserve;
  let currentBtcReserve = btcReserve;

  let reservesExhaustedPrice: bigint | null = null;
  let reservesExhaustedDropPercent: number | null = null;
  let survivesDownToPrice = unprotectedLiqPrice;

  const points: StressSimulationPoint[] = [];
  const defenseSteps: DefenseExecutionStep[] = [];

  for (let d = 0; d <= simEndDrop; d++) {
    // Price at d% drop
    const simPrice = (currentPrice * BigInt(100 - d)) / 100n;

    // Unprotected path
    const unprotectedICR = computeICR(collateral, debt, simPrice);
    const isLiquidatedUnprotected = unprotectedICR < mcr;

    // Protected path before defense at simPrice
    let icrBefore = computeICR(currentColl, currentDebt, simPrice);
    let stepDefended = false;

    if (
      enabled &&
      icrBefore < triggerICR
    ) {
      if (currentMusdReserve > 0n || currentBtcReserve > 0n) {
        const defRes = computeDefenseAmounts({
          currentCollateral: currentColl,
          currentDebt: currentDebt,
          price: simPrice,
          targetICR,
          minNetDebt,
          gasCompensation,
          musdReserve: currentMusdReserve,
          btcReserve: currentBtcReserve,
          maxTipBps,
        });

        if (defRes.musdToRepay > 0n || defRes.btcToAdd > 0n) {
          stepDefended = true;
          currentDebt -= defRes.musdToRepay;
          currentColl += defRes.btcToAdd;
          currentMusdReserve -= defRes.musdToRepay + defRes.musdTip;
          currentBtcReserve -= defRes.btcToAdd + defRes.btcTip;

          const icrAfter = computeICR(currentColl, currentDebt, simPrice);

          defenseSteps.push({
            stepIndex: defenseSteps.length + 1,
            price: simPrice,
            dropPercent: d,
            icrBefore,
            musdRepaid: defRes.musdToRepay,
            musdTip: defRes.musdTip,
            btcAdded: defRes.btcToAdd,
            btcTip: defRes.btcTip,
            icrAfter,
            remainingMusdReserve: currentMusdReserve,
            remainingBtcReserve: currentBtcReserve,
          });

          icrBefore = icrAfter;
        } else if (reservesExhaustedPrice === null) {
          reservesExhaustedPrice = simPrice;
          reservesExhaustedDropPercent = d;
        }
      } else if (reservesExhaustedPrice === null) {
        reservesExhaustedPrice = simPrice;
        reservesExhaustedDropPercent = d;
      }
    }

    const protectedICR = icrBefore;
    const isLiquidatedProtected = protectedICR < mcr;
    const currentProtectedLiqPrice = computeLiquidationPrice(currentColl, currentDebt, mcr);

    // Track survival price
    if (!isLiquidatedProtected) {
      survivesDownToPrice = currentProtectedLiqPrice;
    }

    // Determine redemption risk relative to system TCR
    let redemptionRisk: 'none' | 'low' | 'moderate' | 'high' = 'none';
    if (isLiquidatedProtected || protectedICR < 1150000000000000000n) {
      redemptionRisk = 'high';
    } else if (systemTCR > 0n && protectedICR < systemTCR) {
      redemptionRisk = 'moderate';
    } else if (protectedICR < 1500000000000000000n) {
      redemptionRisk = 'low';
    }

    points.push({
      price: simPrice,
      dropPercent: d,
      unprotectedICR,
      protectedICR,
      unprotectedLiqPrice,
      protectedLiqPrice: currentProtectedLiqPrice,
      isLiquidatedUnprotected,
      isLiquidatedProtected,
      isDefended: stepDefended,
      remainingMusdReserve: currentMusdReserve,
      remainingBtcReserve: currentBtcReserve,
      redemptionRisk,
    });
  }

  const targetPoint = points[maxDrop] || points[points.length - 1];
  const targetPrice = (currentPrice * BigInt(100 - maxDrop)) / 100n;
  const initialProtectedLiqPrice = computeLiquidationPrice(currentColl, currentDebt, mcr);

  return {
    initialPrice: currentPrice,
    targetPrice,
    initialICR,
    unprotectedLiqPrice,
    protectedLiqPrice: initialProtectedLiqPrice,
    survivesDownToPrice,
    reservesExhaustedPrice,
    reservesExhaustedDropPercent,
    points,
    defenseSteps,
    hasDefended: defenseSteps.length > 0,
    isReservesExhausted: reservesExhaustedPrice !== null || (currentMusdReserve === 0n && currentBtcReserve === 0n),
    canSurviveDrop: !targetPoint.isLiquidatedProtected,
    unprotectedSurvivesDrop: !targetPoint.isLiquidatedUnprotected,
  };
}
