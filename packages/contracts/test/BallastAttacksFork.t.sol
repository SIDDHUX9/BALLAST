// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";
import {ITroveManagerMinimal} from "../src/interfaces/ITroveManagerMinimal.sol";
import {IMUSDMinimal} from "../src/interfaces/IMUSDMinimal.sol";

/**
 * @notice Malicious keeper contract attempting reentrancy into BallastVault.
 */
contract MaliciousReentrantKeeper {
    BallastVault public targetVault;
    address public upperHint;
    address public lowerHint;
    bool public hasReentered;
    bytes public reentrancyError;

    constructor(BallastVault _vault) {
        targetVault = _vault;
    }

    function setHints(address _u, address _l) external {
        upperHint = _u;
        lowerHint = _l;
    }

    function attack() external {
        targetVault.defend(upperHint, lowerHint);
    }

    receive() external payable {
        if (!hasReentered) {
            hasReentered = true;
            // Attempt to reenter defend() while inside BTC tip transfer
            try targetVault.defend(upperHint, lowerHint) {
                // If it succeeds, reentrancy guard failed
            } catch (bytes memory err) {
                reentrancyError = err;
            }
        }
    }
}

/**
 * @notice Malicious keeper that intentionally reverts upon receiving BTC tips.
 */
contract MaliciousRevertingKeeper {
    BallastVault public targetVault;

    constructor(BallastVault _vault) {
        targetVault = _vault;
    }

    function attack(address u, address l) external {
        targetVault.defend(u, l);
    }

    receive() external payable {
        revert("Keeper rejects BTC");
    }
}

contract BallastAttacksForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_attack_reentrancyDuringBtcTipFailsSafely() public {
        // 1. Setup a vault with debt and BTC collateral reserve so a BTC tip is generated
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.startPrank(alice);
        vault.depositBTC{value: 1 ether}();
        vault.setRule(true, 1.25e18, 1.50e18, 50); // 50 bps tip
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (bool defendable,,, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);
        assertTrue(btcToAdd > 0);

        (address u2, address l2) = _getHints(coll + btcToAdd, debt);

        // Deploy malicious reentrant keeper
        MaliciousReentrantKeeper attacker = new MaliciousReentrantKeeper(vault);
        attacker.setHints(u2, l2);

        // Execute attack
        attacker.attack();

        assertTrue(attacker.hasReentered(), "Malicious keeper must have triggered receive() hook");
        // Verify reentrancy was blocked
        assertTrue(attacker.reentrancyError().length > 0, "Reentrancy must revert");

        // Trove is properly defended
        uint256 icrAfter = ITroveManagerMinimal(TROVE_MANAGER).getCurrentICR(address(vault), 25_000e18);
        assertTrue(icrAfter >= 1.50e18, "Trove must still reach safe ICR despite reentrancy attempt");
    }

    function test_attack_revertingKeeperRevertsCleanlyWithoutCorruptingState() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.startPrank(alice);
        vault.depositBTC{value: 1 ether}();
        vault.setRule(true, 1.25e18, 1.50e18, 50);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (bool defendable,,, uint256 btcToAdd) = vault.checkDefense();
        assertTrue(defendable);

        (address u2, address l2) = _getHints(coll + btcToAdd, debt);

        MaliciousRevertingKeeper revertingKeeper = new MaliciousRevertingKeeper(vault);

        uint256 btcReserveBefore = vault.btcReserve();

        // Defense must revert because BTC tip transfer fails
        vm.expectRevert(IBallastVault.BtcTransferFailed.selector);
        revertingKeeper.attack(u2, l2);

        // State remains completely intact
        assertEq(vault.btcReserve(), btcReserveBefore, "Tracked BTC reserve must not decrease when keeper reverts");
    }

    function test_attack_strayBtcDoesNotCorruptReserveOrEnableTheft() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        vm.startPrank(alice);
        vault.depositBTC{value: 0.5 ether}();
        vm.stopPrank();

        assertEq(vault.btcReserve(), 0.5 ether);

        // Stranger sends 10 stray BTC directly to the vault
        address stranger = makeAddr("stranger");
        vm.deal(stranger, 10 ether);
        vm.prank(stranger);
        (bool success,) = address(vault).call{value: 10 ether}("");
        assertTrue(success, "Direct BTC transfer should succeed to receive()");

        // Tracked btcReserve MUST NOT change!
        assertEq(vault.btcReserve(), 0.5 ether, "Stray BTC must not alter tracked btcReserve");

        // Stranger tries to withdraw Alice's or the stray BTC -> must revert
        vm.prank(stranger);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.withdrawBTC(0.5 ether);

        // Alice withdraws her 0.5 BTC reserve
        uint256 aliceBtcBefore = alice.balance;
        vm.prank(alice);
        vault.withdrawBTC(0.5 ether);

        assertEq(alice.balance - aliceBtcBefore, 0.5 ether);
        assertEq(vault.btcReserve(), 0);
        // Stray BTC still sits safely in contract without causing any arithmetic error
        assertEq(address(vault).balance, 10 ether);
    }

    function test_attack_strayErc20DoesNotCorruptReserveOrEnableTheft() public {
        _fundMusd(alice, 1000e18);

        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 1000e18);
        vault.depositMUSD(1000e18);
        vm.stopPrank();

        assertEq(vault.musdReserve(), 1000e18);

        // Stranger transfers 5000 MUSD directly without calling depositMUSD
        address stranger = makeAddr("stranger");
        _fundMusd(stranger, 5000e18);
        vm.prank(stranger);
        IMUSDMinimal(MUSD_TOKEN).transfer(address(vault), 5000e18);

        // Tracked musdReserve MUST remain 1000e18
        assertEq(vault.musdReserve(), 1000e18, "Tracked musdReserve must remain unaffected by direct transfers");

        // Stranger cannot withdraw MUSD
        vm.prank(stranger);
        vm.expectRevert(IBallastVault.Unauthorized.selector);
        vault.withdrawMUSD(1000e18);

        // Alice can withdraw her exact 1000 MUSD
        uint256 aliceMusdBefore = IMUSDMinimal(MUSD_TOKEN).balanceOf(alice);
        vm.prank(alice);
        vault.withdrawMUSD(1000e18);

        assertEq(IMUSDMinimal(MUSD_TOKEN).balanceOf(alice) - aliceMusdBefore, 1000e18);
        assertEq(vault.musdReserve(), 0);
    }

    function test_attack_frontRunningOwnerRuleChangeSafe() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        _fundMusd(alice, 5000e18);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 5000e18);
        vault.depositMUSD(5000e18);
        vault.setRule(true, 1.25e18, 1.50e18, 50);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (address u2, address l2) = _getHints(coll, debt - 4000e18);

        // Alice disables the rule
        vm.prank(alice);
        vault.setRule(false, 1.25e18, 1.50e18, 50);

        // Keeper attempts to defend after rule was disabled -> must revert
        vm.prank(keeper);
        vm.expectRevert(IBallastVault.RuleDisabled.selector);
        vault.defend(u2, l2);
    }

    function test_attack_dustReservesRevertsWithoutImprovingICR() public {
        uint256 coll = 1 ether;
        uint256 debt = 20_000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Attacker / griefer deposits 1 wei of MUSD and 1 wei of BTC
        _fundMusd(alice, 100);
        vm.startPrank(alice);
        IMUSDMinimal(MUSD_TOKEN).approve(address(vault), 1);
        vault.depositMUSD(1); // 1 wei
        vault.depositBTC{value: 1}(); // 1 wei
        vault.setRule(true, 1.25e18, 1.50e18, 50);
        vm.stopPrank();

        _mockBtcPrice(25_000e18);

        (address u2, address l2) = _getHints(coll, debt);

        // 1 wei is completely negligible against 20,000e18 debt and 1e18 collateral
        // If it cannot improve ICR or debt repay is clamped to 0, defend must revert cleanly
        vm.prank(keeper);
        // Either InsufficientReserves or ICRDidNotImprove must protect the position
        vm.expectRevert();
        vault.defend(u2, l2);
    }
}
