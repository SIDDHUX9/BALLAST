// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";
import {IPriceFeedMinimal} from "../src/interfaces/IPriceFeedMinimal.sol";

contract BallastDefenseForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_defend_doesNotTriggerWhenICRAboveTrigger() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.prank(alice);
        vault.setRule(true, 1.25e18, 1.50e18, 50);

        // At $80,000, 2 BTC is $160,000. Debt is ~3200 MUSD -> ICR is ~5000% >> 125%
        (address u2, address l2) = _getHints(coll, debt);

        vm.prank(keeper);
        vm.expectRevert(IBallastVault.ICRNotDefendable.selector);
        vault.defend(u2, l2);

        (bool defendable, uint256 currentICR,,) = vault.checkDefense();
        assertFalse(defendable, "Vault must report defendable = false when ICR >= trigger");
        assertTrue(currentICR >= 1.25e18);
    }

    function test_defend_repayOnlyWhenBtcReserveEmpty() public {
        // Open with 1 BTC and 20,000 debt at $80,000 -> ICR is 400%
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Fund MUSD reserve with 5,000 MUSD
        _fundMusd(alice, 5000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 5000e18);
        vault.depositMUSD(5000e18);
        vault.setRule(true, 1.25e18, 1.50e18, 50); // 125% trigger, 150% target, 50 bps tip
        vm.stopPrank();

        // Simulate market price drop: BTC drops from $80,000 to $25,000
        // At $25,000, 1 BTC / ~20,200 debt gives ICR ~123.7% (< 125% trigger)
        _mockBtcPrice(25_000e18);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable, "Vault must be defendable");
        assertTrue(icrBefore < 1.25e18, "ICR must be below trigger");
        assertTrue(musdToRepay > 0, "MUSD repay must be calculated");
        assertEq(btcToAdd, 0, "BTC to add must be 0 when btcReserve is 0");

        (address u2, address l2) = _getHints(coll, debt - musdToRepay);

        uint256 keeperMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        assertTrue(repaid > 0, "Repay must execute");
        assertEq(added, 0, "No collateral added");

        // Keeper tip received
        uint256 keeperMusdAfter = IMUSDMinimal(MUSD_TOKEN).balanceOf(keeper);
        assertTrue(keeperMusdAfter > keeperMusdBefore, "Keeper must receive MUSD tip");

        // Verify post-defense ICR improved
        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 25_000e18);
        assertTrue(icrAfter > icrBefore, "ICR must improve post-defense");
        assertTrue(icrAfter >= 1.50e18, "ICR must reach or exceed 150% target");
    }

    function test_defend_collateralOnlyWhenMusdReserveEmpty() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Fund BTC reserve only (0.5 BTC)
        vm.startPrank(alice);
        vault.depositBTC{value: 0.5 ether}();
        vault.setRule(true, 1.25e18, 1.50e18, 50);
        vm.stopPrank();

        // BTC price drops to $25,000 -> ICR ~123.7% < 125%
        _mockBtcPrice(25_000e18);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);
        assertEq(musdToRepay, 0, "No MUSD repay when musdReserve is 0");
        assertTrue(btcToAdd > 0, "BTC collateral top-up required");

        (address u2, address l2) = _getHints(coll + btcToAdd, debt);

        uint256 keeperBtcBefore = keeper.balance;

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        assertEq(repaid, 0);
        assertTrue(added > 0, "Collateral addition must execute");

        // Keeper received BTC tip
        assertTrue(keeper.balance > keeperBtcBefore, "Keeper must receive BTC tip");

        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 25_000e18);
        assertTrue(icrAfter > icrBefore, "ICR must improve");
    }

    function test_defend_clampsRepayToRespectMinNetDebt() public {
        // Net debt is close to minNetDebt: 2,100 MUSD (net debt 1,900 MUSD)
        uint256 coll = 1 ether;
        uint256 debt = 1900e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        _fundMusd(alice, 1000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 1000e18);
        vault.depositMUSD(1000e18);
        vault.depositBTC{value: 0.5 ether}();
        vault.setRule(true, 1.25e18, 1.50e18, 50);
        vm.stopPrank();

        // Drop price so ICR drops below 125%:
        // At $2500 per BTC, 1 BTC / ~2100 debt -> ICR ~119%
        _mockBtcPrice(2500e18);

        (bool defendable,, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);

        // Repaying cannot reduce net debt below 1,800 MUSD.
        // Net debt is ~1900, so max legal repay is ~100 MUSD even though reserve has 1000 MUSD!
        assertTrue(musdToRepay <= 100e18 + 5e18, "Repay must be clamped to preserve minNetDebt");
        // Shortfall is satisfied via BTC collateral reserve:
        assertTrue(btcToAdd > 0, "Deficit must be satisfied via BTC addition");

        (address u2, address l2) = _getHints(coll + btcToAdd, debt - musdToRepay);

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        assertTrue(repaid > 0);
        assertTrue(added > 0);

        // Verify remaining net debt is strictly >= 1,800 MUSD
        uint256 remainingDebt = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        uint256 remainingNetDebt = remainingDebt - MUSD_GAS_COMPENSATION;
        assertTrue(remainingNetDebt >= MIN_NET_DEBT, "Remaining net debt must not fall below 1,800 MUSD");
    }

    function test_defend_partialWhenReservesAreInsufficient() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Alice only provides a tiny reserve (100 MUSD, 0.01 BTC)
        _fundMusd(alice, 100e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 100e18);
        vault.depositMUSD(100e18);
        vault.depositBTC{value: 0.01 ether}();
        vault.setRule(true, 1.25e18, 1.50e18, 50);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);
        assertTrue(musdToRepay <= 100e18);
        assertTrue(btcToAdd <= 0.01 ether);

        (address u2, address l2) = _getHints(coll + btcToAdd, debt - musdToRepay);

        vm.prank(keeper);
        vault.defend(u2, l2);

        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 25_000e18);
        // Even with partial reserves, defense successfully executes and increases ICR
        assertTrue(icrAfter > icrBefore, "Partial defense must still improve ICR");
    }

    function test_defend_revertsWhenNoImprovementIsPossible() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // No reserves deposited (0 MUSD, 0 BTC)
        vm.prank(alice);
        vault.setRule(true, 1.25e18, 1.50e18, 50);

        _mockBtcPrice(25_000e18);

        (bool defendable,, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertFalse(defendable, "checkDefense must report defendable = false when reserves are 0");
        assertEq(musdToRepay, 0);
        assertEq(btcToAdd, 0);

        (address u2, address l2) = _getHints(coll, debt);

        vm.prank(keeper);
        vm.expectRevert(IBallastVault.InsufficientReserves.selector);
        vault.defend(u2, l2);
    }

    function test_defend_revertsWhenPriceFeedFailsOrIsStale() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.prank(alice);
        vault.setRule(true, 1.25e18, 1.50e18, 50);

        // PriceFeed reverts (simulating stale oracle > 60s or provider crash)
        vm.mockCallRevert(
            PRICE_FEED,
            abi.encodeWithSelector(IPriceFeedMinimal.fetchPrice.selector),
            "PriceFeed: Oracle is stale."
        );

        (address u2, address l2) = _getHints(coll, debt);

        vm.prank(keeper);
        vm.expectRevert("PriceFeed: Oracle is stale.");
        vault.defend(u2, l2);
    }

    function test_defend_mixedRepayAndCollateral_reachesTargetICRWithinTolerance() public {
        uint256 coll = 1 ether;
        uint256 debt = 10_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Alice funds 1,500 MUSD reserve and 0.5 BTC reserve
        _fundMusd(alice, 1500e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 1500e18);
        vault.depositMUSD(1500e18);
        vault.depositBTC{value: 0.5 ether}();
        vault.setRule(true, 1.25e18, 1.60e18, 50); // 125% trigger, 160% target, 50 bps tip
        vm.stopPrank();

        // Drop price to $12,500 -> ICR ~122.5% < 125%
        _mockBtcPrice(12_500e18);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable, "Must be defendable");
        assertTrue(icrBefore < 1.25e18, "ICR before must be below trigger");
        assertTrue(musdToRepay > 0, "Mixed defense must repay MUSD");
        assertTrue(btcToAdd > 0, "Mixed defense must top up BTC collateral");

        (address u2, address l2) = _getHints(coll + btcToAdd, debt - musdToRepay);

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        assertTrue(repaid > 0, "Must have repaid debt");
        assertTrue(added > 0, "Must have added collateral");

        // Target ICR is 1.60e18 (160%). Check post-defense ICR is within 1% (0.01e18) tolerance
        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 12_500e18);
        assertTrue(icrAfter >= 1.60e18, "ICR after must reach target ICR");
        assertTrue(icrAfter <= 1.62e18, "ICR after must be within documented tolerance of target ICR");
    }

    function test_defend_revertsWhenTroveNotActiveOrClosed() public {
        // Vault created but no trove opened yet
        address freshVaultAddr = factory.createVault();
        BallastVault freshVault = BallastVault(payable(freshVaultAddr));

        (address u, address l) = _getHints(1 ether, 2000e18);

        vm.prank(keeper);
        vm.expectRevert(IBallastVault.RuleDisabled.selector);
        freshVault.defend(u, l);

        // Even with rule set, trove is not active
        freshVault.setRule(true, 1.25e18, 1.50e18, 50);

        vm.prank(keeper);
        vm.expectRevert(IBallastVault.TroveNotActive.selector);
        freshVault.defend(u, l);
    }

    function test_defend_whenCollateralReducedByRedemptionOrWithdrawal() public {
        // Borrower opens trove with 2 BTC and 10,000 MUSD
        uint256 coll = 2 ether;
        uint256 debt = 10_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Deposit reserves
        _fundMusd(alice, 3000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 3000e18);
        vault.depositMUSD(3000e18);
        vault.setRule(true, 1.25e18, 1.50e18, 50);

        // Alice withdraws 1 BTC collateral (simulating collateral reduction via partial redemption or withdrawal)
        (address uW, address lW) = _getHints(1 ether, debt);
        vault.withdrawCollateral(1 ether, uW, lW);
        vm.stopPrank();

        // Now collateral is 1 BTC. Drop price to $12,500 -> ICR ~122.5% < 125%
        _mockBtcPrice(12_500e18);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay,) = vault.checkDefense();
        assertTrue(defendable, "Must be defendable after collateral reduction");
        assertTrue(icrBefore < 1.25e18);

        (address u2, address l2) = _getHints(1 ether, debt - musdToRepay);

        vm.prank(keeper);
        (uint256 repaid,) = vault.defend(u2, l2);

        assertTrue(repaid > 0);
        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 12_500e18);
        assertTrue(icrAfter >= 1.50e18, "Trove must be restored to target ICR after redemption/withdrawal reduction");
    }

    function test_defend_functionsDuringRecoveryMode() public {
        // Open trove with 1 BTC and 10,000 MUSD
        uint256 coll = 1 ether;
        uint256 debt = 10_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        _fundMusd(alice, 5000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 5000e18);
        vault.depositMUSD(5000e18);
        vault.setRule(true, 1.25e18, 1.60e18, 50);
        vm.stopPrank();

        // Drop price to $11,000.
        // At $11,000, 1 BTC / ~10,200 debt gives ICR ~107.8% (< 125% trigger).
        _mockBtcPrice(11_000e18);

        (bool defendable, uint256 icrBefore, uint256 musdToRepay, ) = vault.checkDefense();
        assertTrue(defendable);
        assertTrue(icrBefore < 1.25e18);

        // Whether system is in normal or recovery mode, defend solely adds collateral/repays debt, which is always permitted
        (address u2, address l2) = _getHints(coll, debt - musdToRepay);

        vm.prank(keeper);
        (uint256 repaid, uint256 added) = vault.defend(u2, l2);

        assertTrue(repaid > 0 || added > 0, "Defend must execute even in extreme market drops");
        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 11_000e18);
        assertTrue(icrAfter > icrBefore, "ICR must improve post-defense");
        assertTrue(icrAfter >= 1.60e18, "ICR must be elevated to target in recovery mode");
    }
}

