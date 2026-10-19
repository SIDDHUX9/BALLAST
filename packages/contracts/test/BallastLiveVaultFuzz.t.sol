// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";

contract BallastLiveVaultFuzzTest is BaseForkTest {
    BallastVault public vault;

    struct FuzzParams {
        uint256 coll;
        uint256 debt;
        uint256 musdRes;
        uint256 btcRes;
        uint64 triggerICR;
        uint64 targetICR;
        uint16 maxTipBps;
        uint256 dropPrice;
    }

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function _setupPositionAndReserves(FuzzParams memory p) internal {
        (address u1, address l1) = _getHints(p.coll, p.debt);
        vm.prank(alice);
        vault.openTrove{value: p.coll}(p.debt, u1, l1);

        _fundMusd(alice, p.musdRes);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), p.musdRes);
        vault.depositMUSD(p.musdRes);
        vault.depositBTC{value: p.btcRes}();
        vault.setRule(true, p.triggerICR, p.targetICR, p.maxTipBps);
        vm.stopPrank();
    }

    function _verifyPostDefense(
        FuzzParams memory p,
        uint256 icrBefore,
        uint256 keeperMusdBefore,
        uint256 keeperBtcBefore,
        uint256 repaid,
        uint256 added
    ) internal view {
        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), p.dropPrice);
        assertTrue(icrAfter > icrBefore, "Defend must strictly increase ICR");

        uint256 postDebt = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        assertTrue(postDebt - MUSD_GAS_COMPENSATION >= MIN_NET_DEBT, "Net debt must never be reduced below 1,800 MUSD");

        uint256 musdTip = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper) - keeperMusdBefore;
        uint256 btcTip = keeper.balance - keeperBtcBefore;

        if (repaid > 0 && p.maxTipBps > 0) {
            assertEq(musdTip, (repaid * p.maxTipBps) / 10_000);
        }
        if (added > 0 && p.maxTipBps > 0) {
            assertEq(btcTip, (added * p.maxTipBps) / 10_000);
        }

        assertEq(vault.musdReserve(), p.musdRes - (repaid + musdTip));
        assertEq(vault.btcReserve(), p.btcRes - (added + btcTip));
    }

    function testFuzz_liveVaultDefense_randomizedRulesReservesAndPriceDrops(
        uint256 seed1,
        uint256 seed2,
        uint256 seed3,
        uint256 seed4
    ) public {
        FuzzParams memory p;
        p.coll = bound(seed1, 1 ether, 5 ether);
        p.debt = bound(seed2, 3000e18, 30_000e18);
        p.musdRes = bound(seed3, 1000e18, 30_000e18);
        p.btcRes = bound(seed4, 0.1 ether, 2 ether);

        uint256 triggerBps = 12500; // 125%
        uint256 targetBps = 15000;  // 150%
        p.maxTipBps = 50;

        p.triggerICR = uint64((triggerBps * 1e18) / 10_000);
        p.targetICR = uint64((targetBps * 1e18) / 10_000);

        _setupPositionAndReserves(p);

        uint256 totalDebt = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        // Drop price by 10% below trigger
        p.dropPrice = (totalDebt * p.triggerICR * 90) / (p.coll * 100);
        if (p.dropPrice == 0 || p.dropPrice >= 80_000e18) return;

        _mockBtcPrice(p.dropPrice);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        if (!defendable) return;

        assertTrue(icrBefore < p.triggerICR, "ICR before defense must be below trigger");

        (address u2, address l2) = _getHints(p.coll + btcToAdd, totalDebt - musdToRepay);

        uint256 kMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);
        uint256 kBtcBefore = keeper.balance;

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        _verifyPostDefense(p, icrBefore, kMusdBefore, kBtcBefore, repaid, added);
    }
}
