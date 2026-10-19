// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";

contract BallastPermissionsForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_permissions_strangerCannotOpenTrove() public {
        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.openTrove{value: 1 ether}(2000e18, address(0), address(0));
    }

    function test_permissions_strangerCannotBorrowOrRepay() public {
        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.borrowMore(500e18, address(0), address(0), bob);

        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.repay(500e18, address(0), address(0));
    }

    function test_permissions_strangerCannotWithdrawCollateral() public {
        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.withdrawCollateral(1 ether, address(0), address(0));
    }

    function test_permissions_strangerCannotSetRule() public {
        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.setRule(true, 1.20e18, 1.50e18, 50);
    }

    function test_permissions_strangerCannotWithdrawReserves() public {
        // Alice deposits reserves
        _fundMusd(alice, 1000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 1000e18);
        vault.depositMUSD(1000e18);
        vault.depositBTC{value: 1 ether}();
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.withdrawMUSD(500e18);

        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.withdrawBTC(0.5 ether);
    }

    function test_permissions_strangerCannotSweep() public {
        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.sweep(address(0));

        vm.prank(bob);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.sweep(MUSD_TOKEN);
    }

    function test_permissions_ownerCanAlwaysWithdrawReservesAndExit() public {
        _fundMusd(alice, 2000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 2000e18);
        vault.depositMUSD(2000e18);
        vault.depositBTC{value: 2 ether}();

        assertEq(vault.musdReserve(), 2000e18);
        assertEq(vault.btcReserve(), 2 ether);

        uint256 btcBefore = alice.balance;
        uint256 musdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);

        // Owner withdraws full reserves
        vault.withdrawMUSD(2000e18);
        vault.withdrawBTC(2 ether);

        assertEq(vault.musdReserve(), 0);
        assertEq(vault.btcReserve(), 0);
        assertEq(alice.balance - btcBefore, 2 ether);
        assertEq(IMUSDMinimal(MUSD_TOKEN).balanceOf(alice) - musdBefore, 2000e18);
        vm.stopPrank();
    }
}
