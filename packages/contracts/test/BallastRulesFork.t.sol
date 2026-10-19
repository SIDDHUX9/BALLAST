// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BaseForkTest} from "./BaseForkTest.t.sol";
import {BallastVault} from "../src/BallastVault.sol";
import {IBallastVault} from "../src/interfaces/IBallastVault.sol";

contract BallastRulesForkTest is BaseForkTest {
    BallastVault public vault;

    function setUp() public override {
        super.setUp();

        vm.prank(alice);
        address vaultAddr = factory.createVault();
        vault = BallastVault(payable(vaultAddr));
    }

    function test_rule_acceptsValidParameters() public {
        vm.prank(alice);
        vault.setRule(true, 1.20e18, 1.50e18, 50);

        (bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps) = vault.rule();
        assertTrue(enabled);
        assertEq(triggerICR, 1.20e18);
        assertEq(targetICR, 1.50e18);
        assertEq(maxTipBps, 50);
    }

    function test_rule_revertsWhenTriggerBelowMinimumSafetyMargin() public {
        // Less than 112% (1.12e18)
        vm.prank(alice);
        vm.expectRevert(IBallastVault.InvalidTriggerICR.selector);
        vault.setRule(true, 1.11e18, 1.50e18, 50);
    }

    function test_rule_revertsWhenTriggerExceedsCap() public {
        // Greater than 250% (2.50e18)
        vm.prank(alice);
        vm.expectRevert(IBallastVault.InvalidTriggerICR.selector);
        vault.setRule(true, 2.51e18, 2.60e18, 50);
    }

    function test_rule_revertsWhenTargetLessThanTriggerPlusSafetyMargin() public {
        // targetICR must be >= triggerICR + 0.05e18 (500 bps)
        vm.prank(alice);
        vm.expectRevert(IBallastVault.InvalidTargetICR.selector);
        vault.setRule(true, 1.20e18, 1.24e18, 50);
    }

    function test_rule_revertsWhenTargetExceedsCap() public {
        // Greater than 300% (3.00e18)
        vm.prank(alice);
        vm.expectRevert(IBallastVault.InvalidTargetICR.selector);
        vault.setRule(true, 1.50e18, 3.01e18, 50);
    }

    function test_rule_revertsWhenTipExceedsCap() public {
        // Greater than 100 bps (1.00%)
        vm.prank(alice);
        vm.expectRevert(IBallastVault.InvalidMaxTipBps.selector);
        vault.setRule(true, 1.20e18, 1.50e18, 101);
    }

    function test_rule_disabledRuleRevertsDefend() public {
        // Open trove
        uint256 coll = 2 ether;
        uint256 debt = 3000e18;
        (address u, address l) = _getHints(coll, debt);

        vm.prank(alice);
        vault.openTrove{value: coll}(debt, u, l);

        // Configure rule as disabled
        vm.prank(alice);
        vault.setRule(false, 1.20e18, 1.50e18, 50);

        // Crash price so ICR drops below 120%
        _mockBtcPrice(1600e18);

        (address u2, address l2) = _getHints(coll, debt);

        vm.prank(keeper);
        vm.expectRevert(IBallastVault.RuleDisabled.selector);
        vault.defend(u2, l2);
    }

    function test_rule_canDisableAndReenableRule() public {
        vm.startPrank(alice);
        vault.setRule(true, 1.20e18, 1.50e18, 50);
        vault.setRule(false, 0, 0, 0);

        (bool enabled,,,) = vault.rule();
        assertFalse(enabled);

        vault.setRule(true, 1.30e18, 1.60e18, 75);
        (bool enabled2, uint64 trigger, uint64 target, uint16 tip) = vault.rule();
        assertTrue(enabled2);
        assertEq(trigger, 1.30e18);
        assertEq(target, 1.60e18);
        assertEq(tip, 75);
        vm.stopPrank();
    }
}
