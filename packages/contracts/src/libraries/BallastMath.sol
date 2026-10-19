// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title BallastMath
 * @notice Pure mathematical library for ICR, debt repayment, collateral addition, and keeper tip calculations.
 * @dev All functions strictly document rounding directions and utilize OpenZeppelin's Math.mulDiv.
 */
library BallastMath {
    uint256 internal constant DECIMAL_PRECISION = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /**
     * @notice Computes Individual Collateral Ratio (ICR).
     * @dev Rounding direction: DOWN (Floor). Conservative rounding ensures defense triggers
     *      promptly on boundary conditions.
     * @param collateral Wei amount of BTC collateral.
     * @param price 18-decimal USD price per BTC.
     * @param debt Wei amount of total MUSD debt (including interest).
     * @return Current ICR scaled by 1e18 (e.g. 1.20e18 = 120%). Returns type(uint256).max if debt is 0.
     */
    function calculateICR(uint256 collateral, uint256 price, uint256 debt)
        internal
        pure
        returns (uint256)
    {
        if (debt == 0) {
            return type(uint256).max;
        }
        return Math.mulDiv(collateral, price, debt, Math.Rounding.Floor);
    }

    /**
     * @notice Computes target debt for an existing collateral amount to reach targetICR.
     * @dev Rounding direction: DOWN (Floor).
     * @param collateral Wei amount of BTC collateral.
     * @param price 18-decimal USD price per BTC.
     * @param targetICR Target ICR scaled by 1e18 (e.g. 1.50e18 = 150%).
     * @return Target debt in wei of MUSD.
     */
    function calculateTargetDebt(uint256 collateral, uint256 price, uint256 targetICR)
        internal
        pure
        returns (uint256)
    {
        if (targetICR == 0) return 0;
        return Math.mulDiv(collateral, price, targetICR, Math.Rounding.Floor);
    }

    /**
     * @notice Computes the ideal MUSD repayment needed to achieve target debt.
     * @dev Rounding direction: UP (Ceil on repayment deficit) because targetDebt is rounded down.
     * @param currentDebt Current total debt.
     * @param targetDebt Calculated target debt.
     * @return idealRepay MUSD wei to repay.
     */
    function calculateIdealRepay(uint256 currentDebt, uint256 targetDebt)
        internal
        pure
        returns (uint256)
    {
        if (currentDebt > targetDebt) {
            return currentDebt - targetDebt;
        }
        return 0;
    }

    /**
     * @notice Clamps MUSD repayment to respect protocol minimum net debt and available reserves.
     * @dev In Mezo MUSD, net debt cannot fall in (0, minNetDebt). If current net debt is already
     *      <= minNetDebt, no debt repayment is allowed and defense shifts to collateral addition.
     * @param idealRepay Unconstrained repayment needed.
     * @param debt Current total debt (principal + interest + gas compensation).
     * @param minNetDebt Minimum net debt (typically 1,800 MUSD).
     * @param gasCompensation Liquidation gas compensation reserve (200 MUSD).
     * @param musdReserve Available tracked MUSD defense reserve.
     * @param maxTipBps Maximum keeper tip in basis points.
     * @return musdToRepay Legal, reserve-bounded MUSD repayment.
     */
    function clampRepay(
        uint256 idealRepay,
        uint256 debt,
        uint256 minNetDebt,
        uint256 gasCompensation,
        uint256 musdReserve,
        uint16 maxTipBps
    ) internal pure returns (uint256) {
        uint256 netDebt = debt > gasCompensation ? debt - gasCompensation : 0;
        if (netDebt <= minNetDebt) {
            return 0;
        }

        uint256 maxLegalRepay = netDebt - minNetDebt;

        // Ensure musdReserve can cover both the repayment and keeper tip
        uint256 maxReserveRepay = Math.mulDiv(
            musdReserve, BPS_DENOMINATOR, BPS_DENOMINATOR + maxTipBps, Math.Rounding.Floor
        );

        uint256 repay = idealRepay < maxLegalRepay ? idealRepay : maxLegalRepay;
        return repay < maxReserveRepay ? repay : maxReserveRepay;
    }

    /**
     * @notice Computes additional BTC collateral needed to reach targetICR given remaining debt.
     * @dev Rounding direction: UP (Ceil). Rounding up guarantees the resulting ICR is strictly >= targetICR.
     * @param remainingDebt Debt remaining after MUSD repayment.
     * @param price 18-decimal USD price per BTC.
     * @param targetICR Target ICR scaled by 1e18.
     * @param currentCollateral Existing BTC collateral in trove.
     * @param btcReserve Available tracked BTC defense reserve.
     * @param maxTipBps Maximum keeper tip in basis points.
     * @return btcToAdd Bounded BTC collateral addition.
     */
    function calculateCollateralNeeded(
        uint256 remainingDebt,
        uint256 price,
        uint256 targetICR,
        uint256 currentCollateral,
        uint256 btcReserve,
        uint16 maxTipBps
    ) internal pure returns (uint256) {
        if (price == 0) return 0;

        uint256 requiredCollateral =
            Math.mulDiv(targetICR, remainingDebt, price, Math.Rounding.Ceil);

        if (requiredCollateral <= currentCollateral) {
            return 0;
        }

        uint256 idealBtcToAdd = requiredCollateral - currentCollateral;

        // Ensure btcReserve can cover both the collateral top-up and keeper tip
        uint256 maxReserveBtc = Math.mulDiv(
            btcReserve, BPS_DENOMINATOR, BPS_DENOMINATOR + maxTipBps, Math.Rounding.Floor
        );

        return idealBtcToAdd < maxReserveBtc ? idealBtcToAdd : maxReserveBtc;
    }

    /**
     * @notice Computes keeper incentive tip.
     * @dev Rounding direction: DOWN (Floor). Guarantees the tip never exceeds maxTipBps.
     * @param amount Wei amount of asset moved (MUSD repaid or BTC added).
     * @param maxTipBps Keeper tip cap in basis points.
     * @return Tip amount in wei.
     */
    function calculateTip(uint256 amount, uint16 maxTipBps) internal pure returns (uint256) {
        return Math.mulDiv(amount, maxTipBps, BPS_DENOMINATOR, Math.Rounding.Floor);
    }

    struct DefenseParams {
        uint256 currentCollateral;
        uint256 currentDebt;
        uint256 price;
        uint256 targetICR;
        uint256 minNetDebt;
        uint256 gasCompensation;
        uint256 musdReserve;
        uint256 btcReserve;
        uint16 maxTipBps;
    }

    struct DefenseResult {
        uint256 musdToRepay;
        uint256 btcToAdd;
        uint256 musdTip;
        uint256 btcTip;
    }

    /**
     * @notice Orchestrates the complete defense calculation using structured memory parameters.
     * @param params Packed defense parameters.
     * @return res Structured defense outcome containing amounts and tips.
     */
    function computeDefenseAmounts(DefenseParams memory params)
        internal
        pure
        returns (DefenseResult memory res)
    {
        uint256 targetDebt =
            calculateTargetDebt(params.currentCollateral, params.price, params.targetICR);
        uint256 idealRepay = calculateIdealRepay(params.currentDebt, targetDebt);

        res.musdToRepay = clampRepay(
            idealRepay,
            params.currentDebt,
            params.minNetDebt,
            params.gasCompensation,
            params.musdReserve,
            params.maxTipBps
        );

        if (res.musdToRepay > 0) {
            res.musdTip = calculateTip(res.musdToRepay, params.maxTipBps);
        }

        uint256 remainingDebt =
            params.currentDebt > res.musdToRepay ? params.currentDebt - res.musdToRepay : 0;

        res.btcToAdd = calculateCollateralNeeded(
            remainingDebt,
            params.price,
            params.targetICR,
            params.currentCollateral,
            params.btcReserve,
            params.maxTipBps
        );

        if (res.btcToAdd > 0) {
            res.btcTip = calculateTip(res.btcToAdd, params.maxTipBps);
        }
    }
}

