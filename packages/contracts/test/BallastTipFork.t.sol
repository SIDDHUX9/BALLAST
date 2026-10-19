// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";

contract BallastTipForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_tip_boundedByMaxTipBps_paidInMusdOnRepay() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        _fundMusd(alice, 5000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 5000e18);
        vault.depositMUSD(5000e18);
        // Rule: 125% trigger, 150% target, 75 bps tip (0.75%)
        vault.setRule(true, 1.25e18, 1.50e18, 75);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (bool defendable,, uint256 musdToRepay,) = vault.checkDefense();
        assertTrue(defendable);
        assertTrue(musdToRepay > 0);

        (address u2, address l2) = _getHints(coll, debt - musdToRepay);

        uint256 keeperMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);
        uint256 keeperBtcBefore = keeper.balance;

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        uint256 keeperMusdAfter = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);
        uint256 keeperBtcAfter = keeper.balance;

        uint256 musdTip = keeperMusdAfter - keeperMusdBefore;
        uint256 expectedTip = (repaid * 75) / 10_000;

        assertEq(musdTip, expectedTip, "Tip must match exact maxTipBps calculation");
        assertEq(keeperBtcAfter, keeperBtcBefore, "No BTC tip should be paid when only debt is repaid");
        assertEq(added, 0);
        assertTrue(musdTip < repaid, "Tip must never exceed value moved");
    }

    function test_tip_boundedByMaxTipBps_paidInBtcOnCollateralAddition() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.startPrank(alice);
        vault.depositBTC{value: 1 ether}();
        // Rule: 125% trigger, 150% target, 100 bps tip (1% maximum cap)
        vault.setRule(true, 1.25e18, 1.50e18, 100);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (bool defendable,,, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);
        assertTrue(btcToAdd > 0);

        (address u2, address l2) = _getHints(coll + btcToAdd, debt);

        uint256 keeperBtcBefore = keeper.balance;
        uint256 keeperMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);

        vm.prank(keeper);
        (, uint256 added) = vault.defend(u2, l2);

        uint256 btcTip = keeper.balance - keeperBtcBefore;
        uint256 expectedBtcTip = (added * 100) / 10_000;

        assertEq(btcTip, expectedBtcTip, "BTC tip must match exact 100 bps calculation");
        assertEq(IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper), keeperMusdBefore, "No MUSD tip when no debt repaid");
        assertTrue(btcTip < added, "Tip must never exceed collateral value moved");
    }

    function test_tip_zeroWhenMaxTipBpsIsZero() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        _fundMusd(alice, 5000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 5000e18);
        vault.depositMUSD(5000e18);
        vault.depositBTC{value: 0.5 ether}();
        // Rule: maxTipBps = 0 (altruistic keeper / owner keeper)
        vault.setRule(true, 1.25e18, 1.50e18, 0);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (bool defendable,, uint256 musdToRepay,) = vault.checkDefense();
        assertTrue(defendable);

        (address u2, address l2) = _getHints(coll, debt - musdToRepay);

        uint256 keeperMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);
        uint256 keeperBtcBefore = keeper.balance;

        vm.prank(keeper);
        vault.defend(u2, l2);

        assertEq(
            IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper),
            keeperMusdBefore,
            "Keeper must receive zero MUSD tip when maxTipBps == 0"
        );
        assertEq(
            keeper.balance,
            keeperBtcBefore,
            "Keeper must receive zero BTC tip when maxTipBps == 0"
        );
    }

    function test_tip_paidInBothAssetsOnMixedDefense() public {
        uint256 coll = 1 ether;
        uint256 debt = 10_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        _fundMusd(alice, 1000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 1000e18);
        vault.depositMUSD(1000e18);
        vault.depositBTC{value: 0.5 ether}();
        vault.setRule(true, 1.25e18, 1.60e18, 80); // 80 bps tip
        vm.stopPrank();

        _mockBtcPrice(12_500e18);

        (bool defendable,, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);
        assertTrue(musdToRepay > 0);
        assertTrue(btcToAdd > 0);

        (address u2, address l2) = _getHints(coll + btcToAdd, debt - musdToRepay);

        uint256 keeperMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);
        uint256 keeperBtcBefore = keeper.balance;

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        uint256 expectedMusdTip = (repaid * 80) / 10_000;
        uint256 expectedBtcTip = (added * 80) / 10_000;

        assertEq(
            IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper) - keeperMusdBefore,
            expectedMusdTip,
            "MUSD tip must be paid accurately on mixed defense"
        );
        assertEq(
            keeper.balance - keeperBtcBefore,
            expectedBtcTip,
            "BTC tip must be paid accurately on mixed defense"
        );
    }
}
