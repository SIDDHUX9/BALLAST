// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { BallastFactory } from "../src/BallastFactory.sol";
import { BallastVault } from "../src/BallastVault.sol";
import { IBallastVault } from "../src/interfaces/IBallastVault.sol";
import { BallastMath } from "../src/libraries/BallastMath.sol";

contract BallastSmokeTest is Test {
    BallastFactory public factory;
    BallastVault public implementation;

    address public constant DUMMY_BORROWER_OPS = address(0x101);
    address public constant DUMMY_TROVE_MGR = address(0x102);
    address public constant DUMMY_PRICE_FEED = address(0x103);
    address public constant DUMMY_MUSD = address(0x104);
    address public constant DUMMY_SORTED_TROVES = address(0x105);

    address public user = address(0xA11CE);

    function setUp() public {
        implementation = new BallastVault(
            DUMMY_BORROWER_OPS, DUMMY_TROVE_MGR, DUMMY_PRICE_FEED, DUMMY_MUSD, DUMMY_SORTED_TROVES
        );

        factory = new BallastFactory(address(implementation));
    }

    function test_implementation_is_uninitializable() public {
        // Implementation owner is address(1)
        assertEq(implementation.owner(), address(1));

        // Attempting to initialize implementation must revert
        vm.expectRevert(IBallastVault.AlreadyInitialized.selector);
        implementation.initialize(user);
    }

    function test_factory_predict_and_create_vault() public {
        address predicted = factory.predictVault(user);
        assertTrue(predicted != address(0));

        vm.prank(user);
        address vault = factory.createVault();

        assertEq(vault, predicted);
        assertEq(factory.vaultOf(user), vault);

        // Verify clone owner is user
        BallastVault vaultContract = BallastVault(payable(vault));
        assertEq(vaultContract.owner(), user);

        // Verify clone cannot be re-initialized
        vm.expectRevert(IBallastVault.AlreadyInitialized.selector);
        vaultContract.initialize(address(0xB0B));
    }

    function test_rule_validation() public {
        vm.prank(user);
        address vault = factory.createVault();
        BallastVault vaultContract = BallastVault(payable(vault));

        // Valid rule
        vm.prank(user);
        vaultContract.setRule(true, 1.2e18, 1.5e18, 50);

        (bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps) = vaultContract.rule();
        assertTrue(enabled);
        assertEq(triggerICR, 1.2e18);
        assertEq(targetICR, 1.5e18);
        assertEq(maxTipBps, 50);

        // Invalid trigger (< 1.12e18)
        vm.prank(user);
        vm.expectRevert(IBallastVault.InvalidTriggerICR.selector);
        vaultContract.setRule(true, 1.1e18, 1.5e18, 50);

        // Invalid target (< trigger + 0.05e18)
        vm.prank(user);
        vm.expectRevert(IBallastVault.InvalidTargetICR.selector);
        vaultContract.setRule(true, 1.2e18, 1.22e18, 50);

        // Invalid tip (> 100 bps)
        vm.prank(user);
        vm.expectRevert(IBallastVault.InvalidMaxTipBps.selector);
        vaultContract.setRule(true, 1.2e18, 1.5e18, 101);
    }

    function test_math_pure_calculations() public pure {
        // 1 BTC at $80,000, 50,000 debt -> ICR = 160% (1.60e18)
        uint256 icr = BallastMath.calculateICR(1e18, 80_000e18, 50_000e18);
        assertEq(icr, 1_600_000_000_000_000_000); // 1.6e18

        // Target debt to reach 150% ICR with 1 BTC at $80,000:
        // targetDebt = 80000 / 1.5 = 53,333.333333333333333333
        uint256 targetDebt = BallastMath.calculateTargetDebt(1e18, 80_000e18, 1.5e18);
        assertEq(targetDebt, 53_333_333_333_333_333_333_333);

        // Tip calculation: 50 bps on 10,000 MUSD = 50 MUSD
        uint256 tip = BallastMath.calculateTip(10_000e18, 50);
        assertEq(tip, 50e18);
    }
}
