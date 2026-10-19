// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";

contract BallastLifecycleForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_lifecycle_ownerCanOpenTroveWithRealProtocol() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18; // > MIN_NET_DEBT (1800)
        (address u, address l) = _getHints(coll, debt);

        uint256 aliceMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Verify Trove state on Mezo TroveManager
        assertEq(
            uint256(ITroveManagerMinimal(TROVE_MANAGER).getTroveStatus(address(vault))),
            uint256(ITroveManagerMinimal.Status.active),
            "Trove status must be active on-chain"
        );

        assertEq(
            ITroveManagerMinimal(TROVE_MANAGER).getTroveColl(address(vault)),
            coll,
            "Collateral on TroveManager must match 2 BTC"
        );

        // Debt must be at least borrowed amount + gas compensation
        uint256 actualDebt = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        assertTrue(actualDebt >= debt + MUSD_GAS_COMPENSATION, "Debt must include gas compensation");

        // Alice receives the borrowed MUSD
        uint256 aliceMusdAfter = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);
        assertTrue(aliceMusdAfter > aliceMusdBefore, "Alice must receive newly borrowed MUSD");
    }

    function test_lifecycle_ownerCanBorrowMoreMUSD() public {
        uint256 coll = 3 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        uint256 borrowMoreAmount = 500e18;
        (address u2, address l2) = _getHints(coll, debt + borrowMoreAmount);

        uint256 aliceMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);

        vm.prank(alice);
        vault.borrowMore(borrowMoreAmount, u2, l2, alice);

        uint256 aliceMusdAfter = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);
        assertTrue(aliceMusdAfter > aliceMusdBefore, "Alice must receive additional borrowed MUSD");
    }

    function test_lifecycle_ownerCanAddCollateralBTC() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        uint256 topup = 1 ether;
        (address u2, address l2) = _getHints(coll + topup, debt);

        vm.prank(alice);
        vault.addCollateral{value: topup}(u2, l2);

        assertEq(
            ITroveManagerMinimal(TROVE_MANAGER).getTroveColl(address(vault)),
            coll + topup,
            "Trove collateral must increase by 1 BTC"
        );
    }

    function test_lifecycle_ownerCanRepayMUSDWithExactApproval() public {
        uint256 coll = 3 ether;
        uint256 debt = 4000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        uint256 repayAmount = 500e18;
        uint256 debtBefore = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));

        (address u2, address l2) = _getHints(coll, debt - repayAmount);

        // Alice approves vault to pull repayAmount
        vm.prank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), repayAmount);

        vm.prank(alice);
        vault.repay(repayAmount, u2, l2);

        uint256 debtAfter = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        assertTrue(debtAfter < debtBefore, "Debt must decrease after repayment");
    }

    function test_lifecycle_ownerCanWithdrawCollateralBTC() public {
        uint256 coll = 4 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        uint256 withdrawAmount = 0.5 ether;
        (address u2, address l2) = _getHints(coll - withdrawAmount, debt);

        uint256 aliceBtcBefore = alice.balance;

        vm.prank(alice);
        vault.withdrawCollateral(withdrawAmount, u2, l2);

        assertEq(alice.balance - aliceBtcBefore, withdrawAmount, "Alice must receive withdrawn BTC");
        assertEq(
            ITroveManagerMinimal(TROVE_MANAGER).getTroveColl(address(vault)),
            coll - withdrawAmount,
            "Trove collateral must decrease by 0.5 BTC"
        );
    }

    function test_lifecycle_ownerCanCloseTroveAndRecoverCollateralAndReserves() public {
        uint256 coll = 3 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Alice deposits reserves: 500 MUSD and 0.5 BTC
        _fundMusd(alice, 1000e18);

        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 500e18);
        vault.depositMUSD(500e18);
        vault.depositBTC{value: 0.5 ether}();
        vm.stopPrank();

        assertEq(vault.musdReserve(), 500e18);
        assertEq(vault.btcReserve(), 0.5 ether);

        // Alice ensures she has enough MUSD to cover the remaining debt beyond reserve
        uint256 totalDebt = ITroveManagerMinimal(TROVE_MANAGER).getTroveDebt(address(vault));
        uint256 netDebt = totalDebt > MUSD_GAS_COMPENSATION ? totalDebt - MUSD_GAS_COMPENSATION : 0;
        uint256 shortfall = netDebt > 500e18 ? netDebt - 500e18 : 0;

        _fundMusd(alice, shortfall + 100e18);

        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), shortfall);

        uint256 aliceBtcBefore = alice.balance;
        vault.closeTrove();
        vm.stopPrank();

        // Verify Trove is closed on-chain
        assertEq(
            uint256(ITroveManagerMinimal(TROVE_MANAGER).getTroveStatus(address(vault))),
            uint256(ITroveManagerMinimal.Status.closedByOwner),
            "Trove must be closed by owner on TroveManager"
        );

        // Verify Alice received her 3 BTC collateral plus her 0.5 BTC reserve refund
        assertEq(alice.balance - aliceBtcBefore, coll + 0.5 ether, "Alice must recover collateral and BTC reserve");

        // Verify vault reserves are zeroed
        assertEq(vault.musdReserve(), 0, "MUSD reserve must be 0 after close");
        assertEq(vault.btcReserve(), 0, "BTC reserve must be 0 after close");
    }

    function test_lifecycle_openTroveForwardsToRecipient() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        uint256 bobMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(bob);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l, bob);

        uint256 bobMusdAfter = IMUSDMinimal(MUSD_TOKEN).balanceOf(bob);
        assertTrue(bobMusdAfter > bobMusdBefore, "Bob must receive borrowed MUSD when specified as recipient");
    }

    function test_lifecycle_adjustTroveCombinedCollateralAndDebt() public {
        uint256 coll = 3 ether;
        uint256 debt = 4000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        uint256 topupBtc = 0.5 ether;
        uint256 repayMusd = 300e18;

        (address u2, address l2) = _getHints(coll + topupBtc, debt - repayMusd);

        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), repayMusd);
        vault.adjustTrove{value: topupBtc}(0, repayMusd, false, u2, l2);
        vm.stopPrank();

        assertEq(
            ITroveManagerMinimal(TROVE_MANAGER).getTroveColl(address(vault)),
            coll + topupBtc,
            "Collateral must reflect combined top-up"
        );
    }
}
