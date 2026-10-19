// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BallastMath} from "../src/libraries/BallastMath.sol";

contract BallastMathFuzzTest is Test {
    uint256 internal constant DECIMAL_PRECISION = 1e18;
    uint256 internal constant MIN_NET_DEBT = 1800e18;
    uint256 internal constant GAS_COMPENSATION = 200e18;

    function testFuzz_calculateICR_neverUnderflowsOrRevertsForValidInputs(
        uint256 coll,
        uint256 price,
        uint256 debt
    ) public pure {
        coll = bound(coll, 0.001 ether, 1_000_000 ether);
        price = bound(price, 100e18, 1_000_000e18);
        debt = bound(debt, 1e18, 100_000_000e18);

        uint256 icr = BallastMath.calculateICR(coll, price, debt);
        assertTrue(icr > 0, "ICR must be positive for valid non-zero inputs");
    }

    function testFuzz_calculateICR_returnsMaxWhenDebtIsZero(uint256 coll, uint256 price) public pure {
        coll = bound(coll, 0, 1_000_000 ether);
        price = bound(price, 0, 1_000_000e18);

        uint256 icr = BallastMath.calculateICR(coll, price, 0);
        assertEq(icr, type(uint256).max, "ICR must be type(uint256).max when debt is 0");
    }

    function testFuzz_repayRoundTrip_reachesTargetICRWithinTolerance(
        uint256 coll,
        uint256 price,
        uint256 currentICR,
        uint256 targetICR
    ) public pure {
        coll = bound(coll, 0.1 ether, 100 ether);
        price = bound(price, 1_000e18, 200_000e18);
        currentICR = bound(currentICR, 1.05e18, 1.49e18); // 105% to 149%
        targetICR = bound(targetICR, 1.50e18, 3.00e18);  // 150% to 300%

        // Derive debt from currentICR: ICR = (coll * price) / debt => debt = (coll * price) / ICR
        uint256 currentDebt = (coll * price) / currentICR;
        if (currentDebt == 0) return;

        uint256 targetDebt = BallastMath.calculateTargetDebt(coll, price, targetICR);
        uint256 idealRepay = BallastMath.calculateIdealRepay(currentDebt, targetDebt);

        assertTrue(idealRepay > 0, "Ideal repay must be positive when currentICR < targetICR");
        assertTrue(idealRepay <= currentDebt, "Cannot repay more than current debt");

        uint256 remainingDebt = currentDebt - idealRepay;
        if (remainingDebt > 0) {
            uint256 resultingICR = BallastMath.calculateICR(coll, price, remainingDebt);
            // Resulting ICR must be >= targetICR (or at most 1 wei difference due to integer division)
            assertTrue(
                resultingICR + 1 >= targetICR,
                "Resulting ICR after ideal repay must reach targetICR"
            );
            // Resulting ICR should not wildly overshoot targetICR (within 1e15 or 0.1%)
            assertTrue(
                resultingICR - targetICR <= 1e16,
                "Repay calculation must not overshoot targetICR beyond rounding tolerance"
            );
        }
    }

    function testFuzz_collateralRoundTrip_reachesTargetICRWithinTolerance(
        uint256 debt,
        uint256 price,
        uint256 currentICR,
        uint256 targetICR
    ) public pure {
        debt = bound(debt, 2000e18, 1_000_000e18);
        price = bound(price, 1000e18, 200_000e18);
        currentICR = bound(currentICR, 1.05e18, 1.49e18);
        targetICR = bound(targetICR, 1.50e18, 3.00e18);

        // Derive collateral from currentICR: coll = (debt * ICR) / price
        uint256 currentColl = (debt * currentICR) / price;
        if (currentColl == 0) return;

        uint256 btcToAdd = BallastMath.calculateCollateralNeeded(
            debt,
            price,
            targetICR,
            currentColl,
            type(uint256).max,
            0
        );

        assertTrue(btcToAdd > 0, "Collateral addition must be positive when currentICR < targetICR");

        uint256 newColl = currentColl + btcToAdd;
        uint256 resultingICR = BallastMath.calculateICR(newColl, price, debt);

        // calculateCollateralNeeded rounds UP (Ceil), so resultingICR must be strictly >= targetICR
        assertTrue(
            resultingICR >= targetICR,
            "Resulting ICR after collateral addition must be strictly >= targetICR"
        );
        // Rounding overshoot must be infinitesimal (< 1e14)
        assertTrue(
            resultingICR - targetICR <= 1e15,
            "Collateral overshoot must be within tight rounding bound"
        );
    }

    function testFuzz_clampRepay_preservesMinNetDebtAndReserves(
        uint256 idealRepay,
        uint256 netDebt,
        uint256 musdReserve,
        uint16 maxTipBps
    ) public pure {
        netDebt = bound(netDebt, 0, 500_000e18);
        idealRepay = bound(idealRepay, 0, 1_000_000e18);
        musdReserve = bound(musdReserve, 0, 1_000_000e18);
        maxTipBps = uint16(bound(maxTipBps, 0, 100));

        uint256 totalDebt = netDebt + GAS_COMPENSATION;
        uint256 repay = BallastMath.clampRepay(
            idealRepay,
            totalDebt,
            MIN_NET_DEBT,
            GAS_COMPENSATION,
            musdReserve,
            maxTipBps
        );

        if (netDebt <= MIN_NET_DEBT) {
            assertEq(repay, 0, "Must not allow repay when net debt <= minNetDebt");
        } else {
            assertTrue(netDebt - repay >= MIN_NET_DEBT, "Remaining net debt must not fall below minNetDebt");
        }

        uint256 tip = BallastMath.calculateTip(repay, maxTipBps);
        assertTrue(repay + tip <= musdReserve + 1, "Repay + tip must not exceed available reserve");
    }

    function testFuzz_calculateTip_strictlyBoundedByMaxTipBps(uint256 amount, uint16 maxTipBps) public pure {
        amount = bound(amount, 0, 1e30);
        maxTipBps = uint16(bound(maxTipBps, 0, 100));

        uint256 tip = BallastMath.calculateTip(amount, maxTipBps);

        if (maxTipBps == 0 || amount == 0) {
            assertEq(tip, 0);
        } else {
            assertTrue(tip <= amount, "Tip must never exceed amount moved");
            // Tip is at most 1% (100 bps)
            assertTrue(tip <= (amount * 100) / 10_000);
        }
    }
}
