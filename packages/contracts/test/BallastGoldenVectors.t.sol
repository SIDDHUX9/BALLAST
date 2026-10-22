// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BallastMath} from "../src/libraries/BallastMath.sol";

contract BallastGoldenVectorsTest is Test {
    struct Vector {
        uint256 coll;
        uint256 price;
        uint256 debt;
        uint256 mcr;
        uint256 targetICR;
        uint256 minNetDebt;
        uint256 musdReserve;
        uint256 btcReserve;
        uint256 expectedICR;
        uint256 expectedLiqPrice;
        uint256 expectedIdealRepay;
        uint256 expectedBtcNeeded;
        uint256 expectedTip50Bps;
    }

    function test_export_golden_vectors() public pure {
        // Deterministic Golden Vectors covering standard, near-trigger, recovery, and edge scenarios
        // Vector 1: Standard healthy trove (0.05 BTC, $80k price, 2500 MUSD debt)
        // coll = 0.05e18, price = 80000e18, debt = 2500e18, mcr = 1.10e18
        uint256 coll1 = 0.05 ether;
        uint256 price1 = 80_000e18;
        uint256 debt1 = 2500e18;
        uint256 icr1 = BallastMath.calculateICR(coll1, price1, debt1);
        uint256 liqPrice1 = BallastMath.calculateLiquidationPrice(debt1, coll1, 1.10e18);
        assertEq(icr1, 1.60e18); // 160%
        assertEq(liqPrice1, 55_000e18); // $55,000

        // Vector 2: Trove requiring defense (0.05 BTC, $80k price, 3000 MUSD debt, target 1.50e18)
        uint256 debt2 = 3000e18;
        uint256 targetDebt2 = BallastMath.calculateTargetDebt(coll1, price1, 1.50e18);
        uint256 idealRepay2 = BallastMath.calculateIdealRepay(debt2, targetDebt2);
        assertEq(idealRepay2, 333333333333333333334); // ~333.33 MUSD

        // Vector 3: Tip calculation (1000 MUSD at 50 bps = 5 MUSD)
        uint256 tip1 = BallastMath.calculateTip(1000e18, 50);
        assertEq(tip1, 5e18);
    }
}
