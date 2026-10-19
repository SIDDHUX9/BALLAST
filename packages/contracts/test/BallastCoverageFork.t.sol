// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {BallastMath} from "../src/libraries/BallastMath.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract MockStrayToken is ERC20 {
    constructor() ERC20("Stray", "STR") {
        _mint(msg.sender, 10_000e18);
    }
}

contract BallastCoverageForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_coverage_constructorZeroAddressReverts() public {
        vm.expectRevert(IBallastVault.ZeroAddress.selector);
        new BallastVault(address(0), TROVE_MANAGER, PRICE_FEED, MUSD_TOKEN, SORTED_TROVES);

        vm.expectRevert(IBallastVault.ZeroAddress.selector);
        new BallastVault(BORROWER_OPERATIONS, address(0), PRICE_FEED, MUSD_TOKEN, SORTED_TROVES);

        vm.expectRevert(IBallastVault.ZeroAddress.selector);
        new BallastVault(BORROWER_OPERATIONS, TROVE_MANAGER, address(0), MUSD_TOKEN, SORTED_TROVES);

        vm.expectRevert(IBallastVault.ZeroAddress.selector);
        new BallastVault(BORROWER_OPERATIONS, TROVE_MANAGER, PRICE_FEED, address(0), SORTED_TROVES);

        vm.expectRevert(IBallastVault.ZeroAddress.selector);
        new BallastVault(BORROWER_OPERATIONS, TROVE_MANAGER, PRICE_FEED, MUSD_TOKEN, address(0));
    }

    function test_coverage_claimCollateral() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.prank(alice);
        vm.expectRevert("CollSurplusPool: No collateral available to claim");
        vault.claimCollateral();
    }

    function test_coverage_sweepStrayBtcAndTokens() public {
        // 1. Sweep stray native BTC
        vm.deal(address(vault), 2 ether);
        assertEq(vault.btcReserve(), 0);

        uint256 aliceBtcBefore = alice.balance;
        vm.prank(alice);
        vault.sweep(address(0));
        assertEq(alice.balance - aliceBtcBefore, 2 ether);

        // 2. Sweep stray MUSD
        _fundMusd(address(vault), 500e18);
        assertEq(vault.musdReserve(), 0);

        uint256 aliceMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);
        vm.prank(alice);
        vault.sweep(MUSD_TOKEN);
        assertEq(IMUSDMinimal(MUSD_TOKEN).balanceOf(alice) - aliceMusdBefore, 500e18);

        // 3. Sweep arbitrary ERC20
        MockStrayToken stray = new MockStrayToken();
        stray.transfer(address(vault), 1000e18);

        vm.prank(alice);
        vault.sweep(address(stray));
        assertEq(stray.balanceOf(alice), 1000e18);
    }

    function test_coverage_closeTroveWithSurplusMusdReserve() public {
        uint256 coll = 2 ether;
        uint256 debt = 2000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Deposit 5,000 MUSD reserve (well above 2,000 debt + interest)
        _fundMusd(alice, 5000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 5000e18);
        vault.depositMUSD(5000e18);
        vault.depositBTC{value: 1 ether}();

        uint256 aliceMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);
        uint256 aliceBtcBefore = alice.balance;

        vault.closeTrove();
        vm.stopPrank();

        // Alice receives leftover MUSD (around ~3,000 MUSD) and leftover BTC (1 BTC reserve + 2 BTC collateral)
        assertTrue(IMUSDMinimal(MUSD_TOKEN).balanceOf(alice) > aliceMusdBefore);
        assertTrue(alice.balance - aliceBtcBefore >= 3 ether);
        assertEq(vault.musdReserve(), 0);
        assertEq(vault.btcReserve(), 0);
    }

    function test_coverage_adjustTroveBorrowMoreAndWithdrawCollateral() public {
        uint256 coll = 4 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // 1. Borrow more via adjustTrove
        (address u2, address l2) = _getHints(coll, debt + 1000e18);
        uint256 aliceMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);

        vm.prank(alice);
        vault.adjustTrove(0, 1000e18, true, u2, l2);
        assertTrue(IMUSDMinimal(MUSD_TOKEN).balanceOf(alice) > aliceMusdBefore);

        // 2. Withdraw collateral via adjustTrove
        (address u3, address l3) = _getHints(coll - 1 ether, debt + 1000e18);
        uint256 aliceBtcBefore = alice.balance;

        vm.prank(alice);
        vault.adjustTrove(1 ether, 0, false, u3, l3);
        assertEq(alice.balance - aliceBtcBefore, 1 ether);
    }

    function test_coverage_checkDefenseViewBranches() public {
        // Fresh vault: rule disabled
        (bool def1, uint256 icr1, uint256 r1, uint256 a1) = vault.checkDefense();
        assertFalse(def1);
        assertEq(icr1, 0);
        assertEq(r1, 0);
        assertEq(a1, 0);

        // Enable rule without opening trove (status != active)
        vm.prank(alice);
        vault.setRule(true, 1.25e18, 1.50e18, 50);

        (bool def2, uint256 icr2, uint256 r2, uint256 a2) = vault.checkDefense();
        assertFalse(def2);
        assertEq(icr2, 0);
        assertEq(r2, 0);
        assertEq(a2, 0);
    }

    function test_coverage_ballastMathBranches() public pure {
        assertEq(BallastMath.calculateTargetDebt(1 ether, 80_000e18, 0), 0);
        assertEq(BallastMath.calculateCollateralNeeded(2000e18, 0, 1.5e18, 1 ether, 1 ether, 50), 0);
        assertEq(BallastMath.calculateCollateralNeeded(2000e18, 80_000e18, 1.5e18, 10 ether, 1 ether, 50), 0);
        assertEq(BallastMath.clampRepay(1000e18, 1800e18, 1800e18, 200e18, 5000e18, 50), 0);
        assertEq(BallastMath.calculateTip(1000e18, 0), 0);
    }

    function test_coverage_inputValidationReverts() public {
        (address u, address l) = (CANONICAL_HEAD, CANONICAL_TAIL);

        vm.startPrank(alice);

        // borrowMore zero check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.borrowMore(0, u, l, alice);

        // repay zero check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.repay(0, u, l);

        // addCollateral zero check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.addCollateral{value: 0}(u, l);

        // withdrawCollateral zero check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.withdrawCollateral(0, u, l);

        // adjustTrove zero check
        vm.expectRevert("BorrowerOps: There must be either a collateral change or a debt change");
        vault.adjustTrove(0, 0, false, u, l);

        // depositMUSD zero check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.depositMUSD(0);

        // depositBTC zero check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.depositBTC{value: 0}();

        // withdrawMUSD zero and insufficient check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.withdrawMUSD(0);

        vm.expectRevert(IBallastVault.InsufficientReserves.selector);
        vault.withdrawMUSD(100e18);

        // withdrawBTC zero and insufficient check
        vm.expectRevert(IBallastVault.ZeroAmount.selector);
        vault.withdrawBTC(0);

        vm.expectRevert(IBallastVault.InsufficientReserves.selector);
        vault.withdrawBTC(1 ether);

        // setRule maxTipBps > cap check
        vm.expectRevert(IBallastVault.InvalidMaxTipBps.selector);
        vault.setRule(true, 1.25e18, 1.50e18, 101);

        vm.stopPrank();
    }

    function test_coverage_openTroveWithZeroRecipientDefaultsToOwner() public {
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l, address(0));

        assertEq(
            uint256(ITroveManagerMinimal(TROVE_MANAGER).getTroveStatus(address(vault))),
            uint256(ITroveManagerMinimal.Status.active)
        );
    }

    function test_coverage_btcTransferFailedWhenRecipientRejectsBtc() public {
        RevertingBtcRecipient rejectingOwner = new RevertingBtcRecipient();
        vm.deal(address(rejectingOwner), 10 ether);

        // Create vault owned by rejectingOwner
        bytes memory createData = abi.encodeWithSelector(factory.createVault.selector);
        bytes memory ret = rejectingOwner.execute(address(factory), 0, createData);
        address rVaultAddr = abi.decode(ret, (address));
        BallastVault rVault = BallastVault(payable(rVaultAddr));

        // 1. depositBTC succeeds
        rejectingOwner.execute(address(rVault), 1 ether, abi.encodeWithSelector(rVault.depositBTC.selector));
        assertEq(rVault.btcReserve(), 1 ether);

        // 2. withdrawBTC must revert with BtcTransferFailed because owner rejects native BTC
        vm.expectRevert(IBallastVault.BtcTransferFailed.selector);
        rejectingOwner.execute(
            address(rVault),
            0,
            abi.encodeWithSelector(rVault.withdrawBTC.selector, 0.5 ether)
        );

        // 3. sweep(address(0)) must revert with BtcTransferFailed
        vm.deal(address(rVault), 2 ether); // 1 ether excess
        vm.expectRevert(IBallastVault.BtcTransferFailed.selector);
        rejectingOwner.execute(
            address(rVault),
            0,
            abi.encodeWithSelector(rVault.sweep.selector, address(0))
        );
    }

    function test_coverage_initializeZeroAddressReverts() public {
        address clone = Clones.clone(address(implementation));
        vm.expectRevert(IBallastVault.ZeroAddress.selector);
        BallastVault(payable(clone)).initialize(address(0));
    }
}

contract RevertingBtcRecipient {
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory) {
        (bool s, bytes memory res) = target.call{value: value}(data);
        if (!s) {
            assembly {
                revert(add(res, 32), mload(res))
            }
        }
        return res;
    }

    receive() external payable {
        revert("Reject BTC");
    }
}


